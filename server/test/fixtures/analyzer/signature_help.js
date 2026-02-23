function foo(a, b) {

}

let bar = {};

if(foo) {
    bar.b = (a, b, c) => {};
} else {
    bar.b = foo;
}

// bar.b(
bar.b()
//  ^hover