import { Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Tracked } from "./tracked.entity";

@Entity()
export class RelatedThingy {
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne(() => Tracked, tracked => tracked.relatedThingies, { nullable: true })
	tracked: Tracked

	@OneToMany(() => Tracked, tracked => tracked.relatedThingy)
	allTracked: Tracked[]
}