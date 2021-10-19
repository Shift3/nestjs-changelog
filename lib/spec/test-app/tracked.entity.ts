import { BaseEntity, Column, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { TrackChanges } from "../../change.decorator";
import { RelatedThingy } from "./related.entity";

@Entity()
@TrackChanges({
	except: ['ignored']
})
export class Tracked extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column({ nullable: true })
	ignored: string;

	@ManyToOne(() => RelatedThingy, related => related.allTracked)
	relatedThingy: RelatedThingy;

	@OneToMany(() => RelatedThingy, related => related.tracked, { eager: true })
	relatedThingies: RelatedThingy[];

	@DeleteDateColumn()
	deletedAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}