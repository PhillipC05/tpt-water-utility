import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { query } from './database';
import notificationService from './notification-service';

interface SensorData {
  flow_rate?: number;
  pressure?: number;
  level?: number;
  water_level?: number;
  ph?: number;
  turbidity?: number;
  chlorine?: number;
  conductivity?: number;
  temperature?: number;
  temp?: number;
  value?: number;
  [key: string]: any;
}

interface SensorReading {
  sensorId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface AlertData {
  id: number;
  type: string;
  message: string;
  severity: string;
  sensor_id: string;
  created_at: string;
}

interface IoTStatus {
  connected: boolean;
  broker: string;
  topic: string;
}

interface ComplianceStandard {
  id: number;
  parameter: string;
  standard_value: number;
  unit: string;
  regulatory_body?: string;
  created_at: string;
}

class IoTService {
  private client: MqttClient | null = null;
  private connected: boolean = false;
  private mqttBroker: string;
  private mqttTopic: string;
  private io: any = null; // Socket.IO instance

  constructor() {
    this.mqttBroker = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    this.mqttTopic = process.env.MQTT_TOPIC || 'water/utility/#';
  }

  setSocketIO(io: any): void {
    this.io = io;
  }

  connect(): void {
    try {
      const options: IClientOptions = {
        clientId: 'water-utility-server-' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      };

      this.client = mqtt.connect(this.mqttBroker, options);

      this.client.on('connect', () => {
        console.log('Connected to MQTT broker');
        this.connected = true;
        this.client!.subscribe(this.mqttTopic, (err) => {
          if (!err) {
            console.log(`Subscribed to topic: ${this.mqttTopic}`);
          }
        });
      });

      this.client.on('message', (topic: string, message: Buffer) => {
        this.handleMessage(topic, message);
      });

      this.client.on('error', (error: Error) => {
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

  disconnect(): void {
    if (this.client && this.connected) {
      this.client.end();
      this.connected = false;
      console.log('Disconnected from MQTT broker');
    }
  }

  private handleMessage(topic: string, message: Buffer): void {
    try {
      const payload: SensorData = JSON.parse(message.toString());
      console.log(`Received MQTT message on topic ${topic}:`, payload);

      // Parse topic to determine sensor type and ID
      const topicParts = topic.split('/');
      if (topicParts.length >= 4 && topicParts[0] === 'water' && topicParts[1] === 'utility') {
        const sensorType = topicParts[2];
        const sensorId = topicParts[3];

        if (sensorId && sensorType) {
          this.processSensorData(sensorId, sensorType, payload);
        }
      }
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  private async processSensorData(sensorId: string, sensorType: string, data: SensorData): Promise<void> {
    try {
      // Check if sensor exists, create if not
      const sensorResult = await query('SELECT id FROM sensors WHERE id = $1', [sensorId]);

      if (sensorResult.rows.length === 0) {
        // Create sensor if it doesn't exist
        await query(
          'INSERT INTO sensors (id, name, type, status) VALUES ($1, $2, $3, $4)',
          [sensorId, `IoT Sensor ${sensorId}`, sensorType, 'active']
        );
        console.log(`Created new IoT sensor: ${sensorId}`);
      }

      // Insert reading
      const value = this.extractValueFromPayload(data, sensorType);
      if (value !== null) {
        const insertResult = await query(
          'INSERT INTO readings (sensor_id, value, unit) VALUES ($1, $2, $3) RETURNING id',
          [sensorId, value, this.getUnitForSensorType(sensorType)]
        );

        // Update sensor last reading
        await query(
          'UPDATE sensors SET last_reading = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2',
          [value, sensorId]
        );

        // Emit real-time sensor reading update
        if (this.io) {
          const reading: SensorReading = {
            sensorId: sensorId,
            type: sensorType,
            value: value,
            unit: this.getUnitForSensorType(sensorType),
            timestamp: new Date().toISOString()
          };
          this.io.emit('sensor_reading', reading);
        }

        console.log(`Processed reading for sensor ${sensorId}: ${value}`);

        // Check for alerts based on thresholds
        await this.checkThresholds(sensorId, sensorType, value);
      }
    } catch (error) {
      console.error('Error processing sensor data:', error);
    }
  }

  private extractValueFromPayload(data: SensorData, sensorType: string): number | null {
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

  private getUnitForSensorType(sensorType: string): string {
    const units: { [key: string]: string } = {
      flow: 'L/s',
      pressure: 'bar',
      level: 'm',
      quality: 'various',
      temperature: '°C'
    };
    return units[sensorType] || '';
  }

  private async checkThresholds(sensorId: string, sensorType: string, value: number): Promise<void> {
    try {
      // Get compliance standards for this parameter
      const standardResult = await query(
        'SELECT * FROM compliance_standards WHERE parameter = $1',
        [sensorType]
      );

      if (standardResult.rows.length === 0) return;

      const standard: ComplianceStandard = standardResult.rows[0];

      let alertTriggered = false;
      let alertMessage = '';

      if (value > standard.standard_value * 1.2) {
        alertTriggered = true;
        alertMessage = `${sensorType} reading ${value} exceeds safe threshold of ${standard.standard_value}`;
      } else if (value < standard.standard_value * 0.8) {
        alertTriggered = true;
        alertMessage = `${sensorType} reading ${value} below minimum threshold of ${standard.standard_value}`;
      }

      if (alertTriggered) {
        const alertResult = await query(
          'INSERT INTO alerts (type, message, severity, sensor_id) VALUES ($1, $2, $3, $4) RETURNING id',
          ['sensor_threshold', alertMessage, 'high', sensorId]
        );

        const alertId = alertResult.rows[0].id;
        console.log(`Alert created for sensor ${sensorId}: ${alertMessage}`);

        // Emit real-time alert notification
        if (this.io) {
          const alert: AlertData = {
            id: alertId,
            type: 'sensor_threshold',
            message: alertMessage,
            severity: 'high',
            sensor_id: sensorId,
            created_at: new Date().toISOString()
          };
          this.io.emit('new_alert', alert);
        }

        // Send notifications (email/SMS)
        await notificationService.notifyAlert({
          id: alertId,
          type: 'sensor_threshold',
          message: alertMessage,
          severity: 'high',
          sensor_id: sensorId,
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error checking thresholds:', error);
    }
  }

  publishCommand(topic: string, command: any): void {
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

  getStatus(): IoTStatus {
    return {
      connected: this.connected,
      broker: this.mqttBroker,
      topic: this.mqttTopic
    };
  }
}

const iotService = new IoTService();
export default iotService;
