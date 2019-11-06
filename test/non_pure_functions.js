let x = 5;

x;
function foo() {}
foo();
x;

foo = function() {
	x = "inside foo";
	let k = 2;
	let z = () => { k = "inside z" };
	z();
	k;
};
foo();
x;

x = 10;
x;
foo();
x;

foo = () => { x = "inside foo arrow"; };
foo();
x;

(function () {
	x = 100;
})();
x;

hoisted();
x;
function hoisted() {
	x = 50;
}
