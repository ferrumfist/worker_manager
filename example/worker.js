var WorkerManager = require('./worker_manager').slave();

WorkerManager.receive('hello', function(num){
	return new Promise(function(resolve, reject){
		resolve(num*5);
	});
});