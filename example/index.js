var cluster = require('cluster');
var WorkerManager = require('./worker_manager').master(cluster);

const numCPUs = require('os').cpus().length;

cluster.setupMaster({
    exec: __dirname+"/worker.js"
});

var taskList = [];

for(var i=0; i<numCPUs; i++){
	var worker = cluster.fork();
	
	var task = WorkerManager.send(worker, 'hello', i+1);
	
	taskList.push(task);
}

Promise.all(taskList)
	.then(function(result){
		console.log(result);
		
		process.exit(0);
	});