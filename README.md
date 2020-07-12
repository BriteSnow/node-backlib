
Minimalist utilities for backend services. 

- **Typed** Build with typescript for typescript.
- **Modern** Node.js 14 and above, compiled with native class fields and null coalescing native support. 
- **Minimalist** Not a framework, just some libs that can be assembled into an application infrastructure code.
- **PromiseAsync/Await centric** Use Promise/async/await patterns for all async calls. 
- **Web Async** Web request utilities based on [koajs](https://koajs.com/) over express as it is a modern rewrite of more or less the same API with backed in support for Promise/async/await (simplify many of the usecases)


> NOTE: Still under development. If not part of BriteSnow, wait for 0.3.0 and above to use this library. In the meantime feel free to copy/paste code.


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

## isTop

Know if a decorator method is at the `leaf` of the class tree. Usefull when want to apply logic one one per method name. 

```ts

// One per decorator
const leafTracer = newLeafTracer(); 

export function MethodDec() {

	return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
		// original method
		const method = descriptor.value!;
		descriptor.value = async function methodDecWrapper() {
			// must be called on each invocation (because of order of Decoration eval at init time). 
			// However, flag is cache, so fast check. 
			const isLeaf = leafTracer.trace(this.constructor, target.constructor, propertyKey);

			if (isLeaf){
				// here logic to be apply only for the top most method for a given name for this class inheritance tree
			}

			const result = method.apply(this,arguments);// exec and get result

			if (isLeaf){
				// eventual logic post execution
			}

			return result;
		}
	}
}

```