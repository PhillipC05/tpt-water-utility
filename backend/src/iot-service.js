const mqtt = require('mqtt');
const db = require('./database');
const notificationService = require('./notification-service');

class IoTService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.mqttBroker = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    this.mqttTopic = process.env.MQTT_TOPIC || 'water/utility/#';
    this.io = null; // Will be set from index.js
  }

  setSocketIO(io) {
    this.io = io;
  }

  connect() {
    try {
      this.client = mqtt.connect(this.mqttBroker, {
        clientId: 'water-utility-server-' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      this.client.on('connect', () => {
        console.log('Connected to MQTT broker');
        this.connected = true;
        this.client.subscribe(this.mqttTopic, (err) => {
          if (!err) {
            console.log(`Subscribed to topic: ${this.mqttTopic}`);
          }
        });
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      this.client.on('error', (error) => {
        console.error('MQTT connection error:', error);
        this.connected = false;
      });

      this.client.on('offline', () => {
        console.log('MQTT client offline');
        this.connected = false;
      });

      this.client.on('reconnect', () => {
        console.log('MQTT reconnecting...');
      });

    } catch (error) {
      console.error('Failed to connect to MQTT broker:', error);
    }
  }

  disconnect() {
    if (this.client && this.connected) {
      this.client.end();
      this.connected = false;
      console.log('Disconnected from MQTT broker');
    }
  }

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`Received MQTT message on topic ${topic}:`, payload);

      // Parse topic to determine sensor type and ID
      const topicParts = topic.split('/');
      if (topicParts.length >= 3 && topicParts[0] === 'water' && topicParts[1] === 'utility') {
        const sensorType = topicParts[2];
        const sensorId = topicParts[3];

        this.processSensorData(sensorId, sensorType, payload);
      }
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  async processSensorData(sensorId, sensorType, data) {
    try {
      // Check if sensor exists, create if not
      db.get('SELECT id FROM sensors WHERE id = ?', [sensorId], (err, sensor) => {
        if (err) {
          console.error('Database error checking sensor:', err);
          return;
        }

        if (!sensor) {
          // Create sensor if it doesn't exist
          db.run(
            'INSERT INTO sensors (id, name, type, status) VALUES (?, ?, ?, ?)',
            [sensorId, `IoT Sensor ${sensorId}`, sensorType, 'active'],
            (err) => {
              if (err) {
                console.error('Error creating sensor:', err);
                return;
              }
              console.log(`Created new IoT sensor: ${sensorId}`);
            }
          );
        }

        // Insert reading
        const value = this.extractValueFromPayload(data, sensorType);
        if (value !== null) {
          db.run(
            'INSERT INTO readings (sensor_id, value, unit) VALUES (?, ?, ?)',
            [sensorId, value, this.getUnitForSensorType(sensorType)],
            (err) => {
              if (err) {
                console.error('Error inserting reading:', err);
                return;
              }

              // Update sensor last reading
              db.run(
                'UPDATE sensors SET last_reading = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
                [value, sensorId]
              );

              // Emit real-time sensor reading update
              if (this.io) {
                this.io.emit('sensor_reading', {
                  sensorId: sensorId,
                  type: sensorType,
                  value: value,
                  unit: this.getUnitForSensorType(sensorType),
                  timestamp: new Date().toISOString()
                });
              }

              console.log(`Processed reading for sensor ${sensorId}: ${value}`);
            }
          );
        }

        // Check for alerts based on thresholds
        this.checkThresholds(sensorId, sensorType, value);
      });
    } catch (error) {
      console.error('Error processing sensor data:', error);
    }
  }

  extractValueFromPayload(data, sensorType) {
    // Extract value based on sensor type and payload structure
    switch (sensorType) {
      case 'flow':
        return data.flow_rate || data.value || null;
      case 'pressure':
        return data.pressure || data.value || null;
      case 'level':
        return data.level || data.water_level || data.value || null;
      case 'quality':
        return data.ph || data.turbidity || data.chlorine || data.conductivity || data.value || null;
      case 'temperature':
        return data.temperature || data.temp || data.value || null;
      default:
        return data.value || null;
    }
  }

  getUnitForSensorType(sensorType) {
    const units = {
      flow: 'L/s',
      pressure: 'bar',
      level: 'm',
      quality: 'various',
      temperature: '°C'
    };
    return units[sensorType] || '';
  }

  async checkThresholds(sensorId, sensorType, value) {
    // Get compliance standards for this parameter
    const parameter = sensorType;
    db.get(
      'SELECT * FROM compliance_standards WHERE parameter = ?',
      [parameter],
      (err, standard) => {
        if (err || !standard) return;

        let alertTriggered = false;
        let alertMessage = '';

        if (value > standard.standard_value * 1.2) {
          alertTriggered = true;
          alertMessage = `${parameter} reading ${value} exceeds safe threshold of ${standard.standard_value}`;
        } else if (value < standard.standard_value * 0.8) {
          alertTriggered = true;
          alertMessage = `${parameter} reading ${value} below minimum threshold of ${standard.standard_value}`;
        }

        if (alertTriggered) {
          db.run(
            'INSERT INTO alerts (type, message, severity, sensor_id) VALUES (?, ?, ?, ?)',
            ['sensor_threshold', alertMessage, 'high', sensorId],
            function(err) {
              if (err) {
                console.error('Error creating alert:', err);
              } else {
                console.log(`Alert created for sensor ${sensorId}: ${alertMessage}`);

                // Emit real-time alert notification
                if (this.io) {
                  this.io.emit('new_alert', {
                    id: this.lastID,
                    type: 'sensor_threshold',
                    message: alertMessage,
                    severity: 'high',
                    sensor_id: sensorId,
                    created_at: new Date().toISOString()
                  });
                }

                // Send notifications (email/SMS)
                notificationService.notifyAlert({
                  id: this.lastID,
                  type: 'sensor_threshold',
                  message: alertMessage,
                  severity: 'high',
                  sensor_id: sensorId,
                  created_at: new Date().toISOString()
                });
              }
            }.bind(this)
          );
        }
      }
    );
  }

  publishCommand(topic, command) {
    if (this.client && this.connected) {
      this.client.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
        if (err) {
          console.error('Error publishing MQTT command:', err);
        } else {
          console.log(`Published command to ${topic}:`, command);
        }
      });
    } else {
      console.error('MQTT client not connected');
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      broker: this.mqttBroker,
      topic: this.mqttTopic
    };
  }
}

module.exports = new IoTService();
