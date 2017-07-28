var Pap = require('./pap');
var createError = require('http-errors');
var console = require('./log');
var upfront = require('UPFROnt');
var pdp = upfront.pdp;
var clone = require('clone');

var Pdp = function (conf) {
  console.log("intializing pdp: ");
  this.conf = conf;
  this.pap = new Pap(conf);
  /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
      this.conf = conf;
  } else {
      throw createError(500, "Storage module not properly configured!");
  }*/
};

Pdp.prototype.canReadEntityAttribute = function (userInfo, entityInfo, attributeName) {
  var that = this;
  console.log("arguments for canRead " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      console.log("checking whether user with id " + userInfo.id + " can read attribute " + attributeName + " from entity " + JSON.stringify(entityInfo));
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type, attributeName)
      ];
      return Promise.all(ps);
    }).then(function (policies) {
      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can read attribute " + attributeName + " from " + entityInfo.id);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkRead(
        userInfo, policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true)
        resolve();
      else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to read the entity ");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

//TODO this function needs to resolve regardless of whether the call is performed with an entity or a group as the second argment.
Pdp.prototype.canRead = function (userInfo, entityInfo) {
  var that = this;
  console.log("arguments for canRead " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      console.log("checking whether user with id " + userInfo.id + " can read entity " + JSON.stringify(entityInfo));
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type)
      ];
      return Promise.all(ps);
    }).then(function (policies) {
      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can read to " + entityInfo.id);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkRead(
        userInfo, policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true)
        resolve();
      else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to read the entity ");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

Pdp.prototype.canReadEntityPolicies = function (userInfo, entityInfo) {
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return that.canRead(userInfo, entityInfo);
    }).then(function (res) {
      resolve(res);
    }).catch(reject);
  });
};

//resolves with an array of entities that can be read (each entry in the array is an entity)
Pdp.prototype.canReadArray = function (userInfo, entitiesArray) {

  //wrapper so that pdp doesn't reject, gut just continues and returns an empty response
  function buildPromiseReadAcc(that, userInfo, entity) {
    return new Promise(function (res, rej) {
      that.canRead(userInfo, entity).then(function () {
        console.log('user can read entity ' + JSON.stringify(entity));
        res(entity);
      }, res); //NOTE if not possible to read we still resolve but don't add it to the resultset
    });
  }

  var promises = [];
  var that = this;
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      for (var i in entitiesArray)
        promises.push(buildPromiseReadAcc(that, userInfo, entitiesArray[i]));
      return Promise.all(promises);
    }).then(function (entitiesResult) {
      resolve(entitiesResult);
    }, function (cause) {
      reject(cause);
    });
  });
};

Pdp.prototype.canDelete = function (userInfo, entityInfo) {
  return new Promise(function (resolve, reject) {

    //TODO fix this hardcoded policy when UPFront supports action policies.
    if (entityInfo.type === "/user" && userInfo.role === "admin") {
      resolve();
    } else if (entityInfo.owner === userInfo.id)
      resolve();
    else
      reject(createError(403, "user unauthorized for the action for entity :" + JSON.stringify(entityInfo)));

  });
};

//for now this is required to check when a user can put an entity in a group. In this case we check whether the user can change the group
Pdp.prototype.canUpdate = function (userInfo, entityInfo) {
  return new Promise(function (resolve, reject) {
    if (entityInfo.owner === userInfo.id)
      resolve(entityInfo);
    else
      reject(createError(403, "user unauthorized for the action for entity :" + JSON.stringify(entityInfo)));

  });
};

//for now this is required to check when a user can put an entity in a group. In this case we check whether the user can change the group
Pdp.prototype.canSetEntityPolicy = function (userInfo, entityInfo) {
  return this.canUpdate(userInfo, entityInfo);
};

Pdp.prototype.canWriteToAttribute = function (userInfo, entityInfo, attributeName, attributeValue) {
  var that = this;
  console.log("arguments for canWriteToAttribute " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type, attributeName)
      ];
      return Promise.all(ps);
    }).then(function (policies) {

      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can write to " + entityInfo.id + " in attribute " + attributeName);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkWrite(
        userInfo,
        policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true)
        resolve();
      else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to set attribute");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

Pdp.prototype.canWriteToPolicy = function (userInfo, entityInfo, policyName, policy) {
  var that = this;
  console.log("arguments for canWriteToPolicy " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      var ps = [that.pap.getAttributePolicy(userInfo.id, userInfo.type),
        that.pap.getAttributePolicy(entityInfo.id, entityInfo.type, policyName)
      ];
      return Promise.all(ps);
    }).then(function (policies) {

      var userInfoPolicy = policies[0];
      console.log("calling pdp to check wether " + userInfo.id + " can write to " + entityInfo.id + " in policy " + policyName);
      console.log("arguments: ");
      console.log("             " + JSON.stringify(userInfo));
      console.log("             " + JSON.stringify(policies[0]));
      console.log("             " + JSON.stringify(entityInfo));
      console.log("             " + JSON.stringify(policies[1]));
      return pdp.checkWrite(
        userInfo,
        policies[0],
        entityInfo,
        policies[1]);
    }).then(function (decision) {
      console.log("pdp decision " + JSON.stringify(decision));
      if (decision.result === true)
        resolve();
      else {
        var err = createError(403, "policy does not allow  the user (or entity authenticated) to set policy");
        err.conflicts = decision.conflicts;
        reject(err);
      }
    }, reject);

  });
};

//for now we treat update as delete...
Pdp.prototype.canDeleteAttribute = Pdp.prototype.canWriteToAttribute;

//for now we treat update as delete...
Pdp.prototype.canDeletePolicy = Pdp.prototype.canDelete;

Pdp.prototype.canWriteToAllAttributes = function (userInfo, entityInfo, entity_id, entity_type, entity_owner) {
  var that = this;
  console.log("arguments for canWriteToAllAttributes " + JSON.stringify(arguments));
  //promise that always resolves to collect all errors.
  function buildPromise(userInfo, entityInfo, entity_type,
    entity_id, attributeName, attributeValue, entity_owner) {

    return new Promise(function (resolve, reject) {
      entityInfo = clone(entityInfo);
      entityInfo.id = entity_id;
      entityInfo.type = entity_type;
      entityInfo.owner = entity_owner;
      userInfo = clone(userInfo);
      userInfo.type = userInfo.type;
      console.log("building single promise for canWriteToAttribute  user" + JSON.stringify(userInfo));
      console.log("building single promise for canWriteToAttribute  entity" + JSON.stringify(entityInfo));
      that.canWriteToAttribute(userInfo, entityInfo,
        attributeName,
        attributeValue
      ).then(function (result) {
        resolve({
          result: true
        });
      }, function (er) {
        resolve({
          result: false,
          conflicts: er.conflicts
        });
      });
    });
  }
  //now we start with the code
  return new Promise(function (resolve, reject) {
    var promises = [];
    var keys = Object.keys(entityInfo);
    upfront.init(that.conf.upfront).then(function () {

      for (var i in keys) {
        promises.push(buildPromise(userInfo,
          entityInfo,
          entity_type,
          entity_id,
          keys[i],
          entityInfo[keys[i]],
          entity_owner));
      }
      return Promise.all(promises);
    }).then(function (pdpResult) {
      var errors = "policy does not allow the user (or entity authenticated) with id " + userInfo.id + " to set the entity with id " + entity_id + " and type " + entity_type + ". Spefifically the following attributes are not allowed: ";
      var count = 0;
      var conflicts = [];
      for (var i in pdpResult) {
        if (pdpResult[i].result !== true) {
          count = count + 1;
          errors = errors + " " + keys[i];
          conflicts.push({
            "attribute": keys[i],
            "conf": pdpResult[i].conflicts
          });
        }
      }
      if (count > 0) {
        console.log("policy does not allow the user (or entity authenticated) with id " + userInfo.id + " to set the entity with id " + entity_id + " and type " + entity_type);
        console.log("Conflicts for policy " + JSON.stringify(conflicts));
        var err = createError(403, errors);
        err.conflicts = conflicts;
        return reject(err);
      } else
        return resolve();
    }, function (cause) {
      reject(cause);
    });
  });
};

module.exports = Pdp;