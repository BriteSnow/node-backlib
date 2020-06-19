
Minimalist utilities for backend services. 

- **Typed** Build with typescript for typescript.
- **Modern** Node.js 14 and above, compiled with native class fields and null coalescing. 
- **Minimalist** Not a framework, just some libs that can be assembled into an application infrastructure code.
- **PromiseAsync/Await centric** Use Promise/async/await patterns for all async calls. 
- **Web Async** Web request utilities based on [koajs](https://koajs.com/) over express as it is a modern rewrite of more or less the same API with backed in support for Promise/async/await (simplify many of the usecases)


> NOTE: Still under development. If not part of BriteSnow, wait for 0.2.0 and above.


## Log

Provides a `BaseLog` class with a `LogWriter` driver architecture. 

```ts
import {BaseLog, LogWriter} from 'backlib';

interface  WebLogRecord { 
  ...
}

class WebLog extends BaseLog<WebLogRecord>{
	constructor() {
		const writers: LogWriter<WebLogRecord>[] = [];
		const baseName = 'web_log';

		// Add custom writer using redstream (Redis Stream) for realtime login
		const logStream = getWebLogStream(); // not provided
		writers.push({
			name: baseName + '_stream',
			writeRec: async (rec: WebLogRecord) => {
				await logStream.xadd(rec);
			}
		});

		super({ writers });
	}
}
const _webLog = new WebLog(); // must be after ServiceLog definition

export webLog(rec: WebLogRecord){
  _webLog.log(rec);
}
```

