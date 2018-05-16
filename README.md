# await-targz

await-targz is a module working with `Promise` and `async/await` providing operations to pack, unpack, upload and download tarballs. It uses the [pkgcloud API](https://github.com/pkgcloud/pkgcloud) which supports interactions with multiple cloud providers.

## Installation

```sh
npm install await-targz --save
```

## Usage

When using this module, the exported class accepts two arguments.
  - `cdnup` The configurations for setup the cdnup instance. We use [cdnup](https://github.com/warehouseai/cdnup) to easily consume the pkgcloud API.
  - `log` The logger for log out information and error. _Everyone loves logs!_ [diagnostics](https://github.com/bigpipe/diagnostics) is set to default if no specific logger object provided.

An example of how to use it could be:

```js
const Tar = require('await-targz');

const tar = new Tar({
  cdnup: {
    bucket: 'some_mock_bucket',
    pkgcloud: {
      provider: 'amazon',
      endpoint: 'some_end_point',
      keyId: 'this_is_a_mock_key_id',
      key: 'this_is_a_mock_key',
      forcePathBucket: true
    }
  },
  log: your_logger_obj // if no logger provided, it will default to `diagnostics`
});
```

## API

It provides the following API methods.

### pack

You can use this method to pack a tarball by providing the source path and target path.

```js
tar.pack('path/to/source/some-component', 'path/to/target/some-component.tar');
```

### unpack

In reverse, this method is to unpack a tarball to a provided directory.

```js
tar.unpack('path/to/tarball/some-component.tar', 'path/to/dir/some-component');
```
### upload

Once when the pkgcloud API is setup correctly, you can upload the tarball to the provided endpoint, e.g. Ceph object center.

```js
tar.upload({
  name: 'some-component',
  revision: '1a2b3c4'
}, 'path/to/tarball/some-component.tar');
```

Once when you finish uploading, you can check through the corresponding cloud client UI/console to see if the tarball with name e.g. `some-component-1a2b3c4.tgz` is there or not.

### download

You can download an existing tarball to a given directory using:

```js
tar.download({
  name: 'some-component',
  revision: '1a2b3c4'
}, { tarball: 'path/to/save/tarball/some-component.tar' });
```

### exists

You can check if a file/tarball exists or not in remote storage by using:

```js
tar.exists({
  name: 'some-component',
  revision: '1a2b3c4'
});
```

### Test

```js
npm test
```

## License

[MIT](LICENSE.md)

