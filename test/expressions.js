const a = 2;
const b = 5;
const c = a + b;

const d = "d";
const e = "e";
let w = d + e;

let f = true;
let g = false;
let h = f + g;
f = null;
h = f + f;
f = undefined;
h = f + f;

f = function () {};

let x = 2;
let y = "";

let z = x + y;
z = 2 + true;
z = 2 + false;
z = 2 + [];
z = 2 + {};

x = {a: 2};
z = x + 2;
z = x + "aaa";
z = x + true;
z = x + false;
z = x + [];
z = x + null;
z = x + undefined;

x = () => {};
y = function() {};
z = x + y;

/* Unary + */
z = +2;
z = +"2";
z = +"";
z = +"aaa";
z = +true;
z = +false;
z = +[];
z = +{};
z = +(function() {});
z = +(() => {});
z = +null;
z = +undefined;

/* Unary - */
z = -2;
z = -"2";
z = -"";
z = -"aaa";
z = -true;
z = -false;
z = -[];
z = -{};
z = -(function() {});
z = -(() => {});
z = -null;
z = -undefined;

/* Prefix ++ */
x = 2;
z = ++x;

/* Prefix -- */
z = --x;

z = void 2;

z = typeof 2;
z = typeof "aaa";
z = typeof true;
z = typeof false;
z = typeof [];
z = typeof {};
z = typeof (function() {});
z = typeof (() => {});
z = typeof (class {});
z = typeof null;
z = typeof undefined;
class p {};
z = typeof new p();

/* Binary - */
x = 5;
y = 10;

z = x - y;
y = "2";
z = x - y;
y = "a";
z = x - y;
z = 5 - true;
z = 5 - false;
z = 5 - [];
z = 5 - {};
z = 5 - (function() {});
z = 5 - (class {});
z = 5 - null;
z = 5 - undefined;
z = 5 - new p();

/* Binary * */
z = 3 * 3;
z = 3 * "3";
z = 3 * "a";


/* Logical && */

z = 0 && 2;
z = 2 && 0;

/* Logical || */

z = 0 || 2;
z = 2 || 0;

/* Bitwise */
// 5 = 101
// 2 = 10
z = 5 & 2; // 0 = 000
z = 5 | 2; // 7 = 111
z = 2 >> 1;

/* Strict Equality */
z = 5 === 5;
z = 0 === 1;

z = 0 !== 1;
z = "5" !== 5;
z = 0 !== 0;

/* Loose Equality */
z = 5 == 5;
z = 5 == "5";
z = 5 == 6;

const shorthandProperty = 5;
z = {
    a: 2,
    "b": "aaa",
    a: 5,
    c: {
        a: 2
    },
    5: 5,
    shorthandProperty
};

