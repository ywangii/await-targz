const assume = require('assume');
const sinon = require('sinon');
const fs = require('fs');
const tar = require('tar-fs');
const zlib = require('zlib');

const Tar = require('../');
const cdnConfig = require('./fixtures/cdnup');
const MockPipes = require('./utils/mockPipes');

const filename = 'some-component-1234567.tgz';
const tarball = 'some-component.tar';
const file = 'some-component';

describe('Tar', function () {
  this.timeout(5e4);
  let tarInstance;

  beforeEach(() => {
    tarInstance = new Tar({ cdnup: cdnConfig });
    sinon.stub(tarInstance.log);
  });

  afterEach(() => {
    sinon.restore();
  });

  function testError(err, message, errInfo) {
    assume(err.message).equals(message);
    assume(tarInstance.log.error.calledWith(errInfo)).true();
  }

  function delay(fn) {
    setTimeout(() => {
      fn();
    }, 50);
  }

  describe('.pack', () => {
    let packMock, gzipMock, writeMock;

    beforeEach(() => {
      packMock = new MockPipes();
      gzipMock = new MockPipes();
      writeMock = new MockPipes();
      sinon.stub(tar, 'pack').returns(packMock);
      sinon.stub(zlib, 'createGzip').returns(gzipMock);
      sinon.stub(fs, 'createWriteStream').returns(writeMock);
    });

    it('packs the tarball with no error', async () => {
      const emitFinish = () => {
        packMock.emit('end');
        gzipMock.emit('end');
        writeMock.emit('finish');
      };
      delay(emitFinish);

      await tarInstance.pack(file, tarball);
      assume(tarInstance.log.info.calledWith(`Finished pack tarball for some-component`)).true();
    });

    it('returns error when `tar.pack` failed', async () => {
      const packError = () => packMock.emit('error', new Error('tar.pack error'));
      delay(packError);

      try {
        await tarInstance.pack(file, tarball);
      } catch (e) {
        testError(e, `tar.pack error`, `Error in tar.pack operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });

    it('returns error when `zlib.createGzip()` failed', async () => {
      const createGzipError = () => gzipMock.emit('error', new Error('zlib.createGzip error'));
      delay(createGzipError);

      try {
        await tarInstance.pack(file, tarball);
      } catch (e) {
        testError(e, `zlib.createGzip error`, `Error in zlib.createGzip operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });

    it('returns error when `fs.createWriteStream` failed', async () => {
      const writeStreamError = () => writeMock.emit('error', new Error('fs.createWriteStream error'));
      delay(writeStreamError);

      try {
        await tarInstance.pack(file, tarball);
      } catch (e) {
        testError(e, `fs.createWriteStream error`, `Error in fs.createWriteStream operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });
  });

  describe('.unpack', () => {
    let readMock, unzipMock, extractMock;

    beforeEach(() => {
      readMock = new MockPipes();
      unzipMock = new MockPipes();
      extractMock = new MockPipes();
      sinon.stub(fs, 'createReadStream').returns(readMock);
      sinon.stub(zlib, 'createUnzip').returns(unzipMock);
      sinon.stub(tar, 'extract').returns(extractMock);
    });

    it('unpacks the tarball with no error', async () => {
      const emitFinish = () => {
        readMock.emit('end');
        unzipMock.emit('end');
        extractMock.emit('finish');
      };
      delay(emitFinish);

      await tarInstance.unpack(tarball, file);
      assume(tarInstance.log.info.calledWith(`Finished unpack tarball for some-component.tar`)).true();
    });

    it('returns error when `fs.createReadStream` failed', async () => {
      const readStreamError = () => readMock.emit('error', new Error('fs.createReadStream error'));
      delay(readStreamError);

      try {
        await tarInstance.unpack(tarball, file);
      } catch (e) {
        testError(e, `fs.createReadStream error`, `Error in fs.createReadStream operation`);
        return;
      }

      throw new Error('Test should throw an error');
    });

    it('returns error when `zlib.createUnzip` failed', async () => {
      const createUnzipError = () => unzipMock.emit('error', new Error('zlib.createUnzip error'));
      delay(createUnzipError);

      try {
        await tarInstance.unpack(file, tarball);
      } catch (e) {
        testError(e, `zlib.createUnzip error`, `Error in zlib.createUnzip operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });

    it('returns error when `tar.extract` failed', async () => {
      const extractError = () => extractMock.emit('error', new Error('tar.extract error'));
      delay(extractError);

      try {
        await tarInstance.unpack(file, tarball);
      } catch (e) {
        testError(e, `tar.extract error`, `Error in tar.extract operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });
  });

  describe('.upload', () => {
    let uploadStub;

    beforeEach(() => {
      uploadStub = sinon.stub(tarInstance.cdn, 'upload');
    });

    it('successfully uploads the tarball with no error', async () => {
      uploadStub.yieldsAsync(null, 'http://some-url.com');

      await tarInstance.upload(filename, tarball);
      assume(tarInstance.log.info.calledWith(`Finished uploading tarball for package`)).true();
    });

    it('rejects when error happens', async () => {
      uploadStub.yieldsAsync(new Error('Mock Error'));

      try {
        await tarInstance.upload(filename, tarball);
      } catch (e) {
        testError(e, `Mock Error`, `Failed to upload tarball for package`);
        return;
      }

      throw new Error('test should have thrown an error');
    });
  });

  describe('.download', () => {
    let downloadMock, writeMock;
    const paths = { tarball: 'some-component.tar' };

    beforeEach(() => {
      downloadMock = new MockPipes();
      writeMock = new MockPipes();
      sinon.stub(tarInstance.cdn.client, 'download').returns(downloadMock);
      sinon.stub(fs, 'createWriteStream').returns(writeMock);
    });

    it('successfully downloads the tarball with no error', async () => {
      const emitFinish = () => {
        downloadMock.emit('end');
        writeMock.emit('finish');
      };
      delay(emitFinish);

      await tarInstance.download(filename, paths);
      assume(tarInstance.log.info.calledWith(`Finished downloading tarball and written to some-component.tar`)).true();
    });

    it('returns error when download API failed', async () => {
      const downloadError = () => downloadMock.emit('error', new Error('whatever'));
      delay(downloadError);

      try {
        await tarInstance.download(filename, paths);
      } catch (e) {
        testError(e, `whatever`, `Error in client.download operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });

    it('rejects error when `fs.createWriteStream` failed', async () => {
      const fsError = () => writeMock.emit('error', new Error('fs error'));
      delay(fsError);

      try {
        await tarInstance.download(filename, paths);
      } catch (e) {
        testError(e, `fs error`, `Error in fs.createWriteStream operation`);
        return;
      }

      throw new Error('test should have thrown an error');
    });
  });

  describe('remove', () => {
    let removeFileStub;

    beforeEach(() => {
      removeFileStub = sinon.stub(tarInstance.cdn.client, 'removeFile');
    });

    it('removes the file', async () => {
      removeFileStub.yieldsAsync(null);
      await tarInstance.remove(filename);

      assume(tarInstance.log.info.calledWith(`Tarball ${filename} is removed`)).true();
    });

    it('rejects error when `client.removeFile` failed', async () => {
      removeFileStub.yieldsAsync(new Error('removeFile error'));

      try {
        await tarInstance.remove(filename);
      } catch (e) {
        testError(e, `removeFile error`, `Failed to remove the file from database`);
        return;
      }

      throw new Error('test should have thrown an error');
    });
  });

  describe('exists', () => {
    let getFileStub;

    beforeEach(() => {
      getFileStub = sinon.stub(tarInstance.cdn.client, 'getFile');
    });

    it('finds the file if exists', async () => {
      getFileStub.yieldsAsync(null, 'whatever_file_is');

      const msg = await tarInstance.exists(filename);

      assume(msg).is.truthy();
      assume(tarInstance.log.info.calledWith(`tarball some-component-1234567.tgz exists in remote storage.`)).true();
    });

    it('rejects error when `client.getFile` failed due to an error', async () => {
      getFileStub.yieldsAsync(new Error('getFile error'));

      try {
        await tarInstance.exists(filename);
      } catch (e) {
        testError(e, `getFile error`, `Failed to check the existence of the file`);
        return;
      }

      throw new Error('test should have thrown an error');
    });

    it('returns file not found when it does not exist', async () => {
      const err = new Error('Not Found');
      err.code = 'NotFound';
      getFileStub.yieldsAsync(err);

      const msg = await tarInstance.exists(filename);

      assume(msg).falsey();
      assume(tarInstance.log.info.calledWith(`tarball some-component-1234567.tgz is not found in remote storage.`)).true();
    });
  });
});

