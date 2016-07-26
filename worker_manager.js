const FLAG_SEND='send';
const FLAG_RECEIVE='receive';

(function(exports){
	function master(cluster){
		/**
		 * структура
		 *  {
		 *  	worker.id:{
		 *  		command:{
		 *  			resolve: function(),
		 *  			reject: function()
		 *  		}
		 *  	}
		 *  }
		 */
		this.sendResolveLst = {};
		this.callBackList = {};
		
		this.init = function(cluster){
			//сигнал при создании нового worker`а
			cluster.on('online', (worker) => {
				//сигнал на получения сообщения от всех воркеров
				worker.on('message', (msg)=>{
					this.ProcessMessage(worker, msg)
				});
			});
			
			//сигнал прекращения работы воркера
			cluster.on('exit', (worker, code, signal) => {
				this.WorkerEnd(worker);
			});
		}
		this.init(cluster);
		
		/**
		 * Отправка команды в worker 
		 * с ожиданием ответа
		 */
		this.send = function(worker, command, data){
			data = data || {};
			
			return new Promise((resolve, reject)=>{
				/**
				 * WorkerManager - флаг модуля WorkerManager
				 * command - имя команды
				 * data - данные
				 */
				var post = {
					WorkerManager: FLAG_SEND,
					command: command,
					data: data
				};
				
				if( !this.sendResolveLst[worker.id] ){
					this.sendResolveLst[worker.id] = {};
				}
				
				this.sendResolveLst[worker.id][command] = 
					{
						resolve: resolve,
						reject: reject
					}
				worker.send(post);
			});
		}
		
		/**
		 * Обработка получения сообщения от worker`а
		 */
		this.ProcessMessage = function(worker, msg){
			var command = msg.command || '';
			var workid = worker.id;
			
			/**
			 * Если сообщение содержит флаг модуля
			 * от этого воркера (по ид) ожидается ответ
			 * от воркера ожидается ответ (command)
			 */
			if( msg.WorkerManager == FLAG_RECEIVE && this.sendResolveLst[workid] && this.sendResolveLst[workid][command] ){
				//выполняем resolve
				var resolve = this.sendResolveLst[workid][command].resolve;
				resolve(msg.data);
				
				delete this.sendResolveLst[workid][command];
			}
			
			if( msg.WorkerManager == FLAG_SEND && this.callBackList[command] ){
				var callback = this.callBackList[command];
				
				callback.call(null, msg.data).then((data) => {
					
					worker.send({
						WorkerManager: FLAG_RECEIVE,
						command: command,
						data: data
					});
				});
			}
		}
		
		/**
		 * Отработка прекращения работы воркера
		 */
		this.WorkerEnd = function(worker){
			/**
			 * Если от данного воркера ожидается ответ то,
			 * отправляем reject для каждой команды
			 */
			if( this.sendResolveLst[worker.id] ){
				for(var command in this.sendResolveLst[worker.id]){
					var resolveData = this.sendResolveLst[worker.id][command];
					
					resolveData.reject();
				}
				
				delete this.sendResolveLst[worker.id];
			}
		}
		
		/**
		 * Добавление команды
		 * command - команда
		 * callback - Promise
		 */
		this.receive = function(command, callback){
			this.callBackList[command] = callback;
		}
		
		return this;
	}
	
	function slave(){
		/**
		 * структура
		 * {
		 * 		command: callback
		 * }
		 */
		this.callBackList = {};
		this.sendResolveLst = {};
		
		process.on('message', (msg) => {
			if( msg.WorkerManager ){
				var command = msg.command;
				
				/**
				 * Если сообщение содержит флаг модуля и есть callback
				 * на данную команду
				 */
				if( msg.WorkerManager == FLAG_SEND && this.callBackList[command] ){
					var callback = this.callBackList[command];
					
					callback.call(null, msg.data).then((data) => {
						process.send({
							WorkerManager: FLAG_RECEIVE,
							command: command,
							data: data
						});
					});
				}
				
				if( msg.WorkerManager == FLAG_RECEIVE && this.sendResolveLst[command] ){
					//выполняем resolve
					var resolve = this.sendResolveLst[command].resolve;
					resolve(msg.data);
					
					delete this.sendResolveLst[command];
				}
			}
		});
		
		/**
		 * Добавление команды
		 * command - команда
		 * callback - Promise
		 */
		this.receive = function(command, callback){
			this.callBackList[command] = callback;
		}
		
		this.send = function(command, data){
			data = data || {};
			
			return new Promise((resolve, reject)=>{
				/**
				 * WorkerManager - флаг модуля WorkerManager
				 * command - имя команды
				 * data - данные
				 */
				var post = {
					WorkerManager: FLAG_SEND,
					command: command,
					data: data
				};
				
				this.sendResolveLst[command] = 
					{
						resolve: resolve,
						reject: reject
					}
				
				process.send(post);
			});
		}
		
		return this;
	}
	
	exports.master = master;
	exports.slave = slave;
})(exports);
