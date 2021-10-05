import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum ChangeAction {
  CREATE  = 'create',
  UPDATE  = 'update',
  DESTROY = 'destroy',
}

@Entity()
@Index("polymorphic_fk_index", ["itemId", "itemType"])
export class Change {
  public static currentUserId: string | null;

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  itemId: string;

  @Column()
  itemType: string;

  @Column({ type: 'json' })
  json: object;

  @Column({ type: 'json' })
  changes: object;

  @Column({ nullable: true })
  who: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column()
  action: ChangeAction;
}
