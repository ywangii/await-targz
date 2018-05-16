const sinon = require('sinon');
const EventEmitter = require('events');

module.exports = class MockPipes extends EventEmitter {
  constructor() {
    super();

    this.pipe = sinon.stub().callsFake(() => {
      // for .pipe().pipe().pipe()...,
      // to make sure it chained with the existing
      // stub function.
      this.piper = this.piper || new MockPipes();
      return this.piper;
    });
  }
};

