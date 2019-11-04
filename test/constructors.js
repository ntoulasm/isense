const Person = (firstName, lastName, age) => {

  this.firstName = firstName;
  this.lastName = lastName;
  this.age = age;

  this.getFullName = () => this.firstname + this.lastName;

};

let person = new Person();
const j = Person;
person = new j();

class x {
  a = 2;
  b;
  getA() {
    return a;
  }
}

let a = new x();
