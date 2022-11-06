import {
	BaseEntity,
	Column,
	DeleteDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { RelatedThingy } from "./related.entity";

/** An entity that should be ignored by the change tracking system. */
@Entity()
export class UnTracked extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column({ nullable: true })
	ignored: string;

	@ManyToOne(() => RelatedThingy, (related) => related.allTracked)
	relatedThingy: RelatedThingy;

	@OneToMany(() => RelatedThingy, (related) => related.tracked, { eager: true })
	relatedThingies: RelatedThingy[];

	@ManyToMany(() => RelatedThingy, { eager: true })
	@JoinTable()
	manyRelatedThingies: RelatedThingy[];

	@DeleteDateColumn()
	deletedAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
