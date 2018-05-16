const assign = require('object-assign');
const Cdnup = require('cdnup');
const diagnostics = require('diagnostics');
const fs = require('fs');
const tar = require('tar-fs');
const zlib = require('zlib');
const pump = require('pump');

/**
 * Construct the process for packaging the tarball and expose
 * the upload/download functionality to interact with database.
 *
 * @class Tars
 * @param {Object} opts Additional configurations
 * @param {Object} opts.log logger instance
 * @param {Object} opts.cdnup cdnup config
 *
 * @public
 */
module.exports = class Tar {
  constructor(opts) {
    const { cdnup, log } = opts;

    this.cdnConfig = cdnup;
    this.cdn = new Cdnup(this.cdnConfig.bucket, this.cdnConfig);
    //
    // If opts.log doesnt exist, default to use diagnostics.
    //
    this.log = log || {
      info: diagnostics('await-targz:info'),
      error: diagnostics('await-targz:error')
    };
  }

  /**
   * Create and pack the tarball at the target directory
   *
   * @param {String} source Source directory
   * @param {String} target Target directory
   * @returns {Promise} A promise represents if pack tar succeeds or fails
   *
   * @public
   */
  pack(source, target) {
    return {
      then: (fulfill, reject) => {
        const logOpts = { source, target };
        const pack = tar.pack(source).once('error', this._logError(`tar.pack`, logOpts));
        const gzip = zlib.createGzip().once('error', this._logError(`zlib.createGzip`, logOpts));
        const writableStream = fs.createWriteStream(target).once('error', this._logError(`fs.createWriteStream`, logOpts));

        pump(pack, gzip, writableStream, err => {
          if (err) return reject(err);

          this.log.info(`Finished pack tarball for ${source}`, logOpts);
          fulfill();
        });
      }
    };
  }

  /**
   * Unpack the tarball into given directory
   *
   * @param {String} tarball Path for tarball to be extracted
   * @param {String} dir Path for the file to be extracted
   * @returns {Promise} A promise represents if unpack tarball succeeds or fails
   *
   * @public
   */
  unpack(tarball, dir) {
    return {
      then: (fulfill, reject) => {
        const logOpts = { tarball, dir };
        const readableStream = fs.createReadStream(tarball).once('error', this._logError(`fs.createReadStream`, logOpts));
        const unzip = zlib.createUnzip().once('error', this._logError(`zlib.createUnzip`, logOpts));
        const extract = tar.extract(dir).once('error', this._logError(`tar.extract`, logOpts));

        pump(readableStream, unzip, extract, err => {
          if (err) return reject(err);

          this.log.info(`Finished unpack tarball for ${tarball}`, logOpts);
          fulfill();
        });
      }
    };
  }

  /**
   * Upload tarballs to configured endpoint
   *
   * @param {String} filename file/tarball name which will be uploaded to remote storage
   * @param {String} tarball Path to tarball
   * @returns {Promise} A promise represents if upload tarball to object center succeeds or fails
   *
   * @public
   */
  upload(filename, tarball) {
    const logOpts = { tarball, filename };

    return {
      then: (fulfill, reject) => {
        this.log.info(`Start to upload tarball for package`, logOpts);

        this.cdn.upload(tarball, filename, (err, url) => {
          if (err) {
            this.log.error(`Failed to upload tarball for package`, {
              ...logOpts,
              message: err.message,
              stack: err.stack
            });

            return reject(err);
          }

          this.log.info(`Finished uploading tarball for package`, assign({ url }, logOpts));
          fulfill();
        });
      }
    };
  }

  /**
   * Download tarballs from database
   *
   * @param {String} filename file/tarball name stored in remote storage
   * @param {Object} paths Path object
   * @returns {Promise} A promise represents if download tar succeeds or fails
   *
   * @public
   */
  download(filename, paths) {
    return {
      then: (fulfill, reject) => {
        const logOpts = { filename };

        const download = this.cdn.client.download({
          container: this.cdnConfig.bucket,
          remote: filename
        }).once('error', this._logError(`client.download`, logOpts));

        const writableStream = fs.createWriteStream(paths.tarball).once('error', this._logError(`fs.createWriteStream`, logOpts));

        this.log.info(`Start to download tarball for package`, logOpts);
        pump(download, writableStream, error => {
          if (!error) {
            this.log.info(`Finished downloading tarball and written to ${paths.tarball}`);
            return fulfill({ name: filename, path: paths.tarball });
          }

          reject(error);
        });
      }
    };
  }

  /**
   * Check if the file/tarball exists or not in remote storage
   *
   * @param {String} filename name of the file/tarball
   * @returns {Promise} A promise represents the existence of file/tarball
   *
   * @public
   */
  exists(filename) {
    const logOpts = { filename };

    return {
      then: (fulfill, reject) => {
        this.cdn.client.getFile(this.cdnConfig.bucket, filename, err => {
          if (err && err.code === 'NotFound') {
            this.log.info(`tarball ${filename} is not found in remote storage.`);
            return fulfill(false);
          }

          if (err) {
            this.log.error(`Failed to check the existence of the file`, {
              ...logOpts,
              message: err.message,
              stack: err.stack
            });

            return reject(err);
          }

          this.log.info(`tarball ${filename} exists in remote storage.`);
          fulfill(true);
        });
      }
    };
  }

  /**
   * Error logger
   *
   * @param {String} cmd command type
   * @param {Object} logOpts Options for logger
   * @returns {Function} returned error logger function
   *
   * @private
   */
  _logError(cmd, logOpts) {
    return err => {
      this.log.error(`Error in ${cmd} operation`, {
        ...logOpts,
        message: err.message,
        stack: err.stack,
        code: err.code
      });
    };
  }
};

