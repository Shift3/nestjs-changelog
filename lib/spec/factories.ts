import { Factory, Sequence } from '@linnify/typeorm-factory';
import { RelatedThingy } from './test-app/related.entity';
import { Tracked } from './test-app/tracked.entity';
import { UnTracked } from './test-app/untracked.entity';

export class TrackedFactory extends Factory<Tracked> {
	entity = Tracked;

	name = new Sequence((i: number) => `Name ${i}`)
}

export class UnTrackedFactory extends Factory<UnTracked> {
	entity = UnTracked;

	name = new Sequence((i: number) => `Entity ${++i} (untracked)`);
}

export class RelatedFactory extends Factory<RelatedThingy> {
	entity = RelatedThingy;
}