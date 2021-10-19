import { expect } from "chai";
import { describe } from "mocha";
import { Change, ChangeAction } from "../change.entity";
import { ChangeRepository } from "../change.repository";
import { ChangeSubscriber } from "../change.subscriber";
import { TrackedFactory } from "./factories";
import { appModule, connection } from "./helper";
import { RelatedThingy } from "./test-app/related.entity";
import { Tracked } from "./test-app/tracked.entity";
import * as sinon from 'sinon';

const trackedFactory = new TrackedFactory();

describe('Change Tracking', () => {
	let changeRepository: ChangeRepository;

	before(async () => {
		changeRepository = appModule.get(ChangeRepository);
	});

	describe('ChangeRepository', () => {
		describe('#retreiveEntityBeforeChange', () => {
			it('reconstructs an entity to the state before the change', async () => {
				let t = await trackedFactory.create({ name: 'name' });
				t.name = "updated";
				await connection.manager.save(t);

				const change = await changeRepository.lastChange(t);
				const entity = changeRepository.retreiveEntityBeforeChange(change);

				expect(entity.constructor).to.eq(Tracked);
				expect(entity.name).to.eq("name");
			});

			it('returns null when trying to reconstruct an entity before a create', async () => {
				let t = await trackedFactory.create();

				const change = await changeRepository.lastChange(t);
				const entity = changeRepository.retreiveEntityBeforeChange(change);

				expect(entity).to.be.null;
			});
		});

		describe('#createChangeEntry', () => {
			describe('configuration', () => {
				before(() => { ChangeRepository.options.maxChangesPerEntityInstance = 2; });
				after(() => { ChangeRepository.options.maxChangesPerEntityInstance = undefined; })

				it('only creates up to maxChangesPerEntityInstance', async () => {
					let t = await trackedFactory.create({ name: "change 1 - create" });
					t.name = "change 2 - update"; await connection.manager.save(t);
					t.name = "change 3 - update"; await connection.manager.save(t);

					const changeCount = await connection.manager.count(Change);
					expect(changeCount).to.eq(2);

					const firstChange = await changeRepository.firstChange(t);
					expect(firstChange.action).to.eq(ChangeAction.UPDATE);

					const lastChange = await changeRepository.lastChange(t);
					expect(lastChange.action).to.eq(ChangeAction.UPDATE);
				});
			})

			it('respects "except" attributes when serializing json blob', async () => {
				let t = await trackedFactory.create({
					name: "name",
					ignored: "should NOT be included"
				});
				t.name = "newname";
				await connection.manager.save(t);

				let change = await changeRepository.lastChange(t);

				expect(change.json['name']).to.exist;
				expect(change.json['ignored']).to.not.exist;
			});

			it('does not create a change entry when only ignored attributes are changed', async () => {
				let t = await trackedFactory.create();
				t.ignored = "ignored";
				await connection.manager.save(t);	

				const changeCount = await connection.manager.count(Change);

				expect(changeCount).to.eq(1);
			});

			it('does not track changes to timestamp date columns by default', async () => {
				let t = await trackedFactory.create();
				t.updatedAt = new Date();
				await connection.manager.save(t);	

				const changeCount = await connection.manager.count(Change);

				expect(changeCount).to.eq(1);
			});

			it('does not serialize OneToMany', async () => {
				let t = await trackedFactory.create();
				let r = new RelatedThingy();
				r.tracked = t;
				await connection.manager.save(r);	

				t.name = "updated";
				await connection.manager.save(t);	

				const lastChange = await changeRepository.lastChange(t);
				expect(lastChange.json).not.to.include.keys('relatedThingies');
			});

			it('does serialize ManyToOne', async () => {
				let firstRelatedThing = new RelatedThingy();
				await connection.manager.save(firstRelatedThing);

				let t = await trackedFactory.create();
				t.relatedThingy = firstRelatedThing;
				await connection.manager.save(t);
				t.name = "updated";
				await connection.manager.save(t);

				const lastChange = await changeRepository.lastChange(t);

				expect(lastChange.json).to.include.keys('relatedThingy');
				expect(lastChange.json['relatedThingy']).to.eq(firstRelatedThing.id);
			});
		});

		describe('#next', () => {
			it('gets the next change', async () => {
				let t = await trackedFactory.create();
				t.name = "updated";
				await connection.manager.save(t);

				const firstChange = await changeRepository.firstChange(t);
				const nextChange = await changeRepository.next(firstChange);

				expect(nextChange).to.exist;
				expect(nextChange.action).to.eq(ChangeAction.UPDATE);
			});

			it('returns falsy value if there is no next change', async () => {
				let t = await trackedFactory.create();

				const firstChange = await changeRepository.firstChange(t);
				const nextChange = await changeRepository.next(firstChange);

				expect(nextChange).to.not.exist;
			});
		});

		describe('#previous', () => {
			it('gets the previous change', async () => {
				let t = await trackedFactory.create();
				t.name = "updated";
				await connection.manager.save(t);

				const lastChange = await changeRepository.lastChange(t);
				const previousChange = await changeRepository.previous(lastChange);

				expect(previousChange).to.exist;
				expect(previousChange.action).to.eq(ChangeAction.CREATE);
			});

			it('returns falsy value if there is no previous change', async () => {
				let t = await trackedFactory.create();

				const lastChange = await changeRepository.lastChange(t);
				const previousChange = await changeRepository.previous(lastChange);

				expect(previousChange).to.not.exist;
			});
		});

		describe('#revert', () => {
			it('can revert to the state of an object after a change', async () => {
				let t = await trackedFactory.create({ name: "Starting Name" });
				t.name = "Ending Name";
				await connection.manager.save(t);

				const lastChange = await changeRepository.lastChange(t);
				await changeRepository.revert(lastChange);
				await t.reload();

				expect(t.name).to.eq("Starting Name");

				const changeCount = await changeRepository.changeLogQuery(t).getCount();
				expect(changeCount).to.eq(3);
			})

			it('can revert even if the object was destroyed and not tracked', async () => {
				let t = await trackedFactory.create({ name: "Starting Name" });
				t.name = "Ending Name";
				await connection.manager.save(t);
				let oldId = t.id;

				await ChangeSubscriber.disableTracking(async () => {
					await connection.manager.remove(t);
				})

				let tracked = new Tracked();
				tracked.id = oldId;
				const lastChange = await changeRepository.lastChange(tracked);
				await changeRepository.revert(lastChange);

				let entity = await connection.manager.findOne(Tracked, oldId);
				expect(entity.name).to.eq("Starting Name");

				const changeCount = await changeRepository.changeLogQuery(entity).getCount();
				expect(changeCount).to.eq(3);
			});

			it('can revert a newly created object', async () => {
				let t = await trackedFactory.create();

				const lastChange = await changeRepository.lastChange(t);
				await changeRepository.revert(lastChange);

				const trackedCount = await connection.manager.count(Tracked);
				expect(trackedCount).to.eq(0);

				const changeCount = await changeRepository.changeLogQuery(t).getCount();
				expect(changeCount).to.eq(2);

				const currentChange = await changeRepository.next(lastChange);
				expect(currentChange.action).to.eq(ChangeAction.DESTROY);
			});

			it('can resurrect an object from the dead (after removal) as long as it uses the same id', async () => {
				let t = await trackedFactory.create();
				const oldId = t.id;
				await connection.manager.remove(t);

				let tracked = new Tracked();
				tracked.id = oldId;
				let lastChange = await changeRepository.lastChange(tracked);

				await changeRepository.revert(lastChange);
				const trackedCount = await connection.manager.count(Tracked);
				expect(trackedCount).to.eq(1);
			});

			it('can revert a changed ManyToOne', async () => {
				let firstRelatedThing = new RelatedThingy();
				await connection.manager.save(firstRelatedThing);

				let secondRelatedThing = new RelatedThingy();
				await connection.manager.save(secondRelatedThing);

				let t = new Tracked();
				t.name = "name";
				t.relatedThingy = firstRelatedThing;
				await connection.manager.save(t);
				t.name = "updated";
				await connection.manager.save(t);
				t.name = "updated again"
				t.relatedThingy = secondRelatedThing;
				await connection.manager.save(t);

				const lastChange = await changeRepository.lastChange(t);
				await changeRepository.revert(lastChange);
				

				let updatedTracked = await connection.manager.findOne(Tracked, t.id, {
					relations: ['relatedThingy']
				});
				expect(updatedTracked.relatedThingy.id).to.eq(firstRelatedThing.id);
			});

			it('rolls back any changes if revert failed for any reasons', async () => {
				let t = await trackedFactory.create();
				t.name = "updated";
				await connection.manager.save(t);

				// force #createChangeEntry to throw, simulating an error,
				// this should cause a transaction rollback causing the
				// change to `Tracked` to be rolled back.
				const stub = sinon.stub(ChangeRepository.prototype, 'createChangeEntry');
				stub.throws('some error');
				let lastChange = await changeRepository.lastChange(t);
				try {
					await changeRepository.revert(lastChange);
				} catch (e) {}

				await t.reload();
				expect(t.name).to.eq("updated");
			});
		});

		describe('#polymorphicGet', () => {
			it('can traverse a polymorphic foreign key', async () => {
				let t = await trackedFactory.create();

				let traversedFKEntity = await changeRepository.polymorphicGet('Tracked', t.id);

				expect(traversedFKEntity).to.exist; 
				expect(traversedFKEntity.id).to.eq(t.id);
			});
		})
	});

	describe('ChangeSubscriber', () => {
		describe('.disableTracking', () => {
			it('can be disabled via a callback', async () => {
				await ChangeSubscriber.disableTracking(async () => {
					let t = await trackedFactory.create();
					t.name = "changed";
					await connection.manager.save(t);
				});

				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(0);
			})

			it('resumes tracking after callback is finished', async () => {
				await ChangeSubscriber.disableTracking(async () => {
					await trackedFactory.create();
				});
				
				await trackedFactory.create();

				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(1);
			});
		});

		describe('#afterInsert', () => {
			it('tracks creation', async () => {
				await trackedFactory.create();

				const changeCount = await connection.manager.count(Change);

				expect(changeCount).to.eq(1);
			});

			it('can workaround the scuffed callback system', async () => {
				const insertResult = await connection.manager.insert(Tracked, { name: 'name' });

				let changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(0);

				const tracked = await connection.manager.findOne(Tracked, insertResult.identifiers[0].id);
				await changeRepository.createChangeEntry(tracked, ChangeAction.CREATE);
				changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(1);
			});

			// not posisble at the moment due to typeorm limitation
			xit('tracks creation when using repo.insert()', async () => {
				await connection.manager.getRepository(Tracked).insert({
					name: 'name'
				});

				const changeCount = await connection.manager.count(Change);

				expect(changeCount).to.eq(1);
			})
		});

		describe('#afterUpdate', () => {
			it('tracks updates to an entites updated via manager.save(entity)', async () => {
				let t = await trackedFactory.create({ name: "Starting Name" });
				t.name = "Ending Name";
				await connection.manager.save(t);

				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(2);

				let lastChange = await changeRepository.lastChange(t);
				expect(lastChange.action).to.eq(ChangeAction.UPDATE);
				expect(lastChange.changes).to.have.key('name');
				expect(lastChange.changes['name'][0]).to.eq('Starting Name');
				expect(lastChange.changes['name'][1]).to.eq('Ending Name');
			});

			it('tracks updates to an entites updated via entity.save()', async () => {
				let t = await trackedFactory.create({ name: "Starting Name" });
				t.name = "Ending Name";
				await t.save();

				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(2);
			});

			it('can workaround the scuffed callback system', async () => {
				const entityBefore = await trackedFactory.create();
				await connection.manager.update(Tracked, { id: entityBefore.id }, { name: 'name' });

				let changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(1);

				const entityAfter = await connection.manager.findOne(Tracked, entityBefore.id);
				await changeRepository.createChangeEntry(entityAfter, ChangeAction.UPDATE, entityBefore);
				changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(2);
			});

			// not possible at the moment due to typeorm limitation.
			xit('tracks updates to an entites via repo.update(entity)', async () => {
				let t = await trackedFactory.create({ name: "Starting Name" });
				await connection.manager.getRepository(Tracked).update(t.id, { name: 'Ending Name' })

				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(2);
			});


			xit('tracks softRemove', async () => {
				let t = await trackedFactory.create();
				
				await connection.manager.softRemove(t);

				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(2);
			})
		});

		describe('#beforeRemove', () => {
			it('tracks removal', async () => {
				let t = await trackedFactory.create();
				
				await connection.manager.remove(t);
				
				const changeCount = await connection.manager.count(Change);
				expect(changeCount).to.eq(2);
			});
		});
	});
});
