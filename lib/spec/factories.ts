import { Factory, Sequence } from '@linnify/typeorm-factory';
import { Tracked } from './test-app/tracked.entity';

export class TrackedFactory extends Factory<Tracked> {
	entity = Tracked;

	name = new Sequence((i: number) => `Name ${i}`)
}