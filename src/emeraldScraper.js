"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var puppeteer_1 = require("puppeteer");
function setNestedValue(obj, path, value) {
    return __awaiter(this, void 0, void 0, function () {
        var current, i, lastKey;
        return __generator(this, function (_a) {
            current = obj;
            // Navigate to the correct nested position
            for (i = 0; i < path.length - 1; i++) {
                if (!(path[i] in current)) {
                    current[path[i]] = {};
                }
                current = current[path[i]];
            }
            lastKey = path[path.length - 1];
            if (!(lastKey in current)) {
                current[lastKey] = [];
            }
            current[lastKey].push(value);
            return [2 /*return*/];
        });
    });
}
function scrapeEmeraldCatalog() {
    return __awaiter(this, void 0, void 0, function () {
        function processAccordion(selector) {
            return __awaiter(this, void 0, void 0, function () {
                var accordionDivs, _i, accordionDivs_1, accordionDiv, headerText, expander, links, _a, links_1, link, name_1, url, nestedSelector;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: 
                        // Wait for the accordion div to be present
                        return [4 /*yield*/, page.waitForSelector(selector)];
                        case 1:
                            // Wait for the accordion div to be present
                            _b.sent();
                            return [4 /*yield*/, page.$$(selector)];
                        case 2:
                            accordionDivs = _b.sent();
                            _i = 0, accordionDivs_1 = accordionDivs;
                            _b.label = 3;
                        case 3:
                            if (!(_i < accordionDivs_1.length)) return [3 /*break*/, 18];
                            accordionDiv = accordionDivs_1[_i];
                            return [4 /*yield*/, accordionDiv.$eval('span[class*="ObjectBrowser__CatalogBrowserHeaderText-"]', function (el) { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ''; })];
                        case 4:
                            headerText = _b.sent();
                            stack.push(headerText);
                            console.error('Current stack:', stack.join(' > '));
                            return [4 /*yield*/, accordionDiv.$('img[class*="ListItemAccordion__ListItemAccordionExpander-"]')];
                        case 5:
                            expander = _b.sent();
                            if (!expander) return [3 /*break*/, 16];
                            // Click to expand
                            return [4 /*yield*/, expander.click()];
                        case 6:
                            // Click to expand
                            _b.sent();
                            // Wait for animation and content to load
                            return [4 /*yield*/, page.waitForSelector('ul[class*="ObjectBrowser__CatalogBrowserHeaderList-"]', { visible: true })];
                        case 7:
                            // Wait for animation and content to load
                            _b.sent();
                            return [4 /*yield*/, accordionDiv.$$('a')];
                        case 8:
                            links = _b.sent();
                            if (!(links.length > 0)) return [3 /*break*/, 14];
                            _a = 0, links_1 = links;
                            _b.label = 9;
                        case 9:
                            if (!(_a < links_1.length)) return [3 /*break*/, 13];
                            link = links_1[_a];
                            return [4 /*yield*/, link.evaluate(function (el) { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ''; })];
                        case 10:
                            name_1 = _b.sent();
                            return [4 /*yield*/, link.evaluate(function (el) { return el.getAttribute('href') || ''; })];
                        case 11:
                            url = _b.sent();
                            console.error('Found leaf:', { stack: stack.join(' > '), name: name_1, url: url });
                            setNestedValue(result, __spreadArray([], stack, true), { name: name_1, url: url });
                            _b.label = 12;
                        case 12:
                            _a++;
                            return [3 /*break*/, 9];
                        case 13: return [3 /*break*/, 16];
                        case 14:
                            nestedSelector = 'div[class*="ListItemAccordion__ListItemAccordionExpandableDiv-"]';
                            return [4 /*yield*/, processAccordion(nestedSelector)];
                        case 15:
                            _b.sent();
                            _b.label = 16;
                        case 16:
                            stack.pop();
                            _b.label = 17;
                        case 17:
                            _i++;
                            return [3 /*break*/, 3];
                        case 18: return [2 /*return*/];
                    }
                });
            });
        }
        var browser, page, result, stack, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, puppeteer_1.default.launch({
                        headless: false,
                        defaultViewport: { width: 1920, height: 1080 }
                    })];
                case 1:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newPage()];
                case 2:
                    page = _a.sent();
                    return [4 /*yield*/, page.goto('https://www.emeraldcloudlab.com/documentation/objects/', {
                            waitUntil: 'networkidle0'
                        })];
                case 3:
                    _a.sent();
                    // Wait for initial load
                    return [4 /*yield*/, page.waitForSelector('div[class*="ListItemAccordion__ListItemAccordionExpandableDiv-"]', { timeout: 2000 })];
                case 4:
                    // Wait for initial load
                    _a.sent();
                    result = {};
                    stack = [];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, 8, 10]);
                    return [4 /*yield*/, processAccordion('div[class*="ListItemAccordion__ListItemAccordionExpandableDiv-"]')];
                case 6:
                    _a.sent();
                    console.log(JSON.stringify(result, null, 2));
                    return [3 /*break*/, 10];
                case 7:
                    error_1 = _a.sent();
                    console.error('Error during scraping:', error_1);
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, browser.close()];
                case 9:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
scrapeEmeraldCatalog().catch(console.error);
