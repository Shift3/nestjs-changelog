- [x] Add a wrapper for TypeOrmConfig to automatically add change detection support to it.
- [x] Get testing setup here going again, bring in the same mocha chai setup I used on `typeorm-database-cleaner`
- [x] allow ability to customize serialization.
- [x] Allow interceptor to be customized with a different way of fetching the user id from the request
- [x] Ability to temporarily disable change logging, maybe cb style. e.g:

	Change.disableTracking(() => {
		// blah
	});

Later:
- [ ] Ability to customize Change entity.
- [ ] Support and track softDelete, pretty sure those register as an update event, should check how to confirm that in the subscriber.
- [ ] Should we be able to track changes across associations? This seems like a lot of complexity, maybe a later goal? Papertrail doesn't even do this, but have an experimental gem extensions to do it, so it may be worth considering.
