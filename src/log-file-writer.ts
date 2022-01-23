import { pathExists } from 'fs-aux';
import { appendFile, mkdir, rename } from 'fs/promises';
import * as Path from "path";
import { isString } from 'utils-min';
import { LogWriter } from './index.js';

export type OnFileCompleted = (file: string) => Promise<void>;
export type FileNameProvider = (rev: number) => string;

/** Record serializer to string, which will be appended to the file. If null, record will be skipped */
export type RecordSerializer<R> = (rec: R) => string | null;

export interface FileWriterOptions<R> {
  /** Local directory in which the logs files will be saved */
  dir: string;
  /** maxCount of record before file is uploaded to destination */
  maxCount: number;
  /** max time (in seconds) before file is uploaded to destination (which ever comes first with maxCount) */
  maxTime: number;

  /** Optional fileName generator for the new log file name (MUST BE UNIQUE for this dir) */
  fileNameProvider?: FileNameProvider,
  /* Optional recordSerializer to file. By default, JSON.serializer() (new line json) */
  recordSerializer?: RecordSerializer<R>;
  /* Call when a log file is completed (i.e., new entries will go to another file) */
  onFileCompleted?: OnFileCompleted;

}

export class FileWriter<R> implements LogWriter<R> {
  readonly name = 'to-deprecate'; // TODO: to deprecate
  private dir: string;
  private maxCount: number;
  private maxTime: number;

  private fileNameProvider: FileNameProvider;
  private recordSerializer: RecordSerializer<R>;
  private onFileCompleted?: OnFileCompleted;

  private _init = false;
  private _rev = 0;
  private count = 0;
  private nextUpload: number | null = null; // null means nothing scheduled
  private lastUpload?: number;

  private file?: string;

  constructor(opts: FileWriterOptions<R>) {
    this.maxCount = opts.maxCount;
    this.maxTime = opts.maxTime;
    this.dir = opts.dir;
    this.fileNameProvider = opts.fileNameProvider ?? defaultFileNameProvider;
    this.onFileCompleted = opts.onFileCompleted;
    this.recordSerializer = opts.recordSerializer ?? defaultSerializer;
  }

  private async init() {
    if (!this._init) {
      await mkdir(this.dir, { recursive: true });
      this.rev();
      this._init = true;
    }
  }

  /** Update the revision file */
  private rev() {
    this.count = 0;
    this._rev = this._rev + 1;

    const fileName = this.fileNameProvider(this._rev);

    this.file = Path.join(this.dir, fileName)
  }


  /** IMPLEMENTATION of the FileWriter interface */
  async writeRec(rec: R) {

    if (!this._init) {
      await this.init();
    }

    const str = this.recordSerializer(rec);
    if (str != null) {
      const strWithNl = str + '\n'; // add the new line
      await appendFile(this.file!, strWithNl);
    }

    // add count
    this.count = this.count + 1;

    // if we are above the count, we upload
    if (this.count > this.maxCount) {
      console.log(`->> rev ${this.name} because count ${this.count} > maxCount ${this.maxCount}`);
      await this.endFile();
    }
    // if still below the count, but do not have this.nextUpload, schedule one
    else if (this.nextUpload === null) {
      const maxTimeMs = this.maxTime * 1000; // in ms

      const nextUpload = Date.now() + maxTimeMs;
      this.nextUpload = nextUpload;

      setTimeout(async () => {
        // perform only if this.nextUpload match the scheduled nextUpload (otherwise, was already processed and this schedule is outdated)
        if (this.nextUpload === nextUpload) {
          console.log(`->> rev ${this.name} because maxTimeMs ${maxTimeMs}`);
          await this.endFile();
        }
      }, maxTimeMs);
    }

  }

  private async endFile() {
    const file = this.file!;
    // we rev just before to make sure other logs will happen on new files
    this.rev();

    try {
      const exists = await pathExists(file);
      if (exists) {
        if (this.onFileCompleted) {
          try {
            console.log(`->> endFile processing ${this.name} `);
            await this.onFileCompleted(file);
          } catch (ex: any) {
            console.log(`LOG PROCESSING ERROR - processing file '${file}' caused the following error: ${ex}`);
          }
        }
      } else {
        console.log(`LOG PROCESSING REMOVE ERROR - cannot be processed file '${file}' does not exists anymore`);
      }

    }
    // Note: note sure we need this global catch now. 
    catch (ex: any) {
      console.log(`LOG PROCESSING - logger.processLogFile - cannot upload to big query ${file}, ${ex.message}`);
      await rename(file, file + '.error');
    }

    this.count = 0;
    this.lastUpload = Date.now();
    this.nextUpload = null;
  }

}

/** default serializer */

function defaultSerializer<R>(rec: R): string {
  return isString(rec) ? rec : JSON.stringify(rec);
}

function defaultFileNameProvider(rev: number): string {
  const date = new Date().toISOString().replace(/[T:.]/g, "-").slice(0, -1);
  const revStr = `${rev}`.padStart(5, '0');
  return `log-file-${date}-${revStr}.log`;
}