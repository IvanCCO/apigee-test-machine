function remove(obj, props) {
  if (Array.isArray(props)) {
    props.forEach(function (prop) {
      delete obj[prop];
    });
  } else if (typeof props === "string") {
    delete obj[props];
  }
  return obj;
}

function mergedObject(obj, props) {
  var result = {};
  if (Array.isArray(props)) {
    props.forEach(function (prop) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        var currentValue = obj[prop];
        if (currentValue && typeof currentValue === "object") {
          Object.keys(currentValue).forEach(function (key) {
            result[key] = currentValue[key];
          });
        } else {
          result[prop] = currentValue;
        }
      }
    });
    return result;
  } else {
    var data = obj[props] || {};
    if (typeof data === "object") {
      return data;
    } else {
      return null;
    }
  }
}
