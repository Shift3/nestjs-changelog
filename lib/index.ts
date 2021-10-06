import { ConnectionOptions } from 'typeorm';
import { Change } from './change.entity';
import { ChangeSubscriber } from './change.subscriber';

export * from './change.decorator';
export * from './change.entity';
export * from './change.interceptor';
export * from './change.module';
export * from './change.repository';
export * from './change.subscriber';

export function addChangeDetectionToConnection(config: ConnectionOptions) {
	return {
		...config,
		entities: [...(config.entities || []), Change],
		subscribers: [...(config.subscribers || []), ChangeSubscriber]
	};
}