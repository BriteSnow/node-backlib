import { appendFileSync, openSync } from 'fs';
import { pathExists } from 'fs-aux';
import { appendFile, FileHandle, mkdir, open, rename } from 'fs/promises';
import * as Path from "path";
import { isString } from 'utils-min';
import { LogWriter } from './index.js';

export type FileNameProvider = (rev: number) => string;
export type FileHeaderProvider = () => string | null; // must be sync
export type OnFileCompleted = (file: string) => Promise<void>;

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
  /** Called when the log file is first created (useful to create the csv header for csv format) */
  fileHeaderProvider?: FileHeaderProvider;
  /** Optional recordSerializer to file. By default, JSON.serializer() (new line json) */
  recordSerializer?: RecordSerializer<R>;
  /** Called when a log file is completed (i.e., new entries will go to another file) */
  onFileCompleted?: OnFileCompleted;

}

export class FileWriter<R> implements LogWriter<R> {
  private dir: string;
  private maxCount: number;
  private maxTime: number;

  private fileNameProvider: FileNameProvider;
  private fileHeaderProvider: FileHeaderProvider;
  private recordSerializer: RecordSerializer<R>;
  private onFileCompleted?: OnFileCompleted;

  private _init = false;
  private _rev = 0;
  private count = 0;
  private nextUpload: number | null = null; // null means nothing scheduled
  private lastUpload?: number;

  private filePath?: string;
  private fileHandle?: FileHandle;

  constructor(opts: FileWriterOptions<R>) {
    this.maxCount = opts.maxCount;
    this.maxTime = opts.maxTime;
    this.dir = opts.dir;
    this.fileNameProvider = opts.fileNameProvider ?? defaultFileNameProvider;
    this.fileHeaderProvider = opts.fileHeaderProvider ?? defaultFileHeaderProvider;
    this.onFileCompleted = opts.onFileCompleted;
    this.recordSerializer = opts.recordSerializer ?? defaultSerializer;
  }

  private async init() {
    if (!this._init) {
      await mkdir(this.dir, { recursive: true });
      await this.rev();
      this._init = true;
    }
  }

  /** Update the revision file and create the new file and call onFileStart */
  private async rev() {
    this.count = 0;
    this._rev = this._rev + 1;

    // make sure to reset the file info
    this.filePath = undefined;
    this.fileHandle = undefined;

    // -- CREATE the new file
    const fileName = this.fileNameProvider(this._rev);
    this.filePath = Path.join(this.dir, fileName);

    // create and add the content Sync to make sure header is always first
    let fd = openSync(this.filePath, 'a');
    let fileHeader = this.fileHeaderProvider();
    if (fileHeader != null) {
      appendFileSync(fd, fileHeader + '\n');
    } else {
      // make sure it is created (might not be needed)
      appendFileSync(fd, '');
    }

    // -- CREATE the file handler
    this.fileHandle = await open(this.filePath, 'a');
  }


  /** IMPLEMENTATION of the FileWriter interface */
  async writeRec(rec: R) {
    if (!this._init) {
      await this.init();
    }

    if (this.fileHandle == null) {
      console.log(`BACKLIB ERROR - FileHandle for log file not ready yet ${this.filePath}`);
      return;
    }

    const str = this.recordSerializer(rec);
    if (str != null) {
      const strWithNl = str + '\n'; // add the new line
      await appendFile(this.fileHandle!, strWithNl);
    }

    // add count
    this.count = this.count + 1;

    // if we are above the count, we upload
    if (this.count > this.maxCount) {
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
          await this.endFile();
        }
      }, maxTimeMs);
    }

  }

  private async endFile() {
    const file = this.filePath!;
    const fileHandle = this.fileHandle;

    // we rev just before to make sure other logs will happen on new files
    await this.rev();

    // process old file
    try {
      const exists = await pathExists(file);
      if (exists) {
        await fileHandle?.close();
        if (this.onFileCompleted) {
          try {
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
      console.log(`LOG PROCESSING - logger.processLogFile - cannot end log file '${file}', ${ex.message}`);
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

function defaultFileHeaderProvider(): string | null {
  // Return null, meaning, no header
  return null;

  // For CSV, custom onFileStart will need to set the header
}

function defaultFileNameProvider(rev: number): string {
  const date = new Date().toISOString().replace(/[T:.]/g, "-").slice(0, -1);
  const revStr = `${rev}`.padStart(5, '0');
  return `log-file-${date}-${revStr}.log`;
}