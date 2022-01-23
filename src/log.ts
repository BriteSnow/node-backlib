
// const { pathExists, mkdirs, appendFile, rename } = (await import('fs-extra')).default;


//#region    ---------- BaseLog ---------- 
export interface LogOptions<R> {
	writers: LogWriter<R>[]
}

/**
 * Base Log class that handle the base log management logic. 
 */
export class BaseLog<R> {
	private logWriters: LogWriter<R>[] = [];

	constructor(opts: LogOptions<R>) {
		this.logWriters = [...opts.writers];
	}

	async log(rec: R) {

		// 
		for (const writer of this.logWriters) {
			if (writer.writeRec) {
				try {
					await writer.writeRec(rec);
				} catch (ex) {
					// here log console.log, no choise
					console.log(`ERROR - BACKLIB - Log exception when writeRec on logWriter ${writer}. ${ex}`);
				}
			}
		}

	}

}
//#endregion ---------- /BaseLog ---------- 

export interface LogWriter<R> {
	writeRec?(rec: R): Promise<void>
}

