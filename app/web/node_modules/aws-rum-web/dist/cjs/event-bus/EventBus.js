"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Topic = void 0;
var Topic;
(function (Topic) {
    Topic["EVENT"] = "event";
})(Topic = exports.Topic || (exports.Topic = {}));
/** A topic-based event bus to facilitate communication between plugins */
var EventBus = /** @class */ (function () {
    function EventBus() {
        // map<topic, subscriber>
        this.subscribers = new Map();
    }
    EventBus.prototype.subscribe = function (topic, subscriber) {
        var _a;
        var list = (_a = this.subscribers.get(topic)) !== null && _a !== void 0 ? _a : [];
        if (!list.length) {
            this.subscribers.set(topic, list);
        }
        list.push(subscriber);
    };
    EventBus.prototype.unsubscribe = function (topic, subscriber) {
        var list = this.subscribers.get(topic);
        if (list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i] === subscriber) {
                    list.splice(i, 1);
                    return true;
                }
            }
        }
        return false;
    };
    EventBus.prototype.dispatch = function (topic, message) {
        var list = this.subscribers.get(topic);
        if (list) {
            for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
                var subscriber = list_1[_i];
                subscriber(message);
            }
        }
    };
    return EventBus;
}());
exports.default = EventBus;
