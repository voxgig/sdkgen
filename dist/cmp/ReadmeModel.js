"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeModel = void 0;
const jostraca_1 = require("jostraca");
const ReadmeModel = (0, jostraca_1.cmp)(function ReadmeModel(props) {
    const { ctx$: { model } } = props;
    (0, jostraca_1.Code)(`
## Entity Model

This SDK uses an entity-oriented interface, rather than exposing
endpoint paths directly.  Business logic can be mapped directly to
business entities in your code.

The SDK itself allows you to create one or more client instances,
which can be used concurrently in the same thread. Each client
instance provides a set of entity methods to create entity
instances. Each entity instance can likewise operate independently.


### SDK Methods

* \`make(options)\`: Create a new client instance. 


### Client Methods

* \`[Entity]()\`: Create a new business entity instance. 


### Entity Methods

* \`data(data?)\`: Set the data properties of the entity, returning the current data.
* \`load(query)\`: Load matching single entity data into the entity instance.
* \`save(data?)\`: Save the current entity, optionally setting data.
* \`list(query)\`: List matching entities, return an array of new entities.
* \`remove(query)\`: Delete the matching single entity.

`);
});
exports.ReadmeModel = ReadmeModel;
//# sourceMappingURL=ReadmeModel.js.map