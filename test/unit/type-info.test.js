const TypeInfo = require('../../server/src/utility/type-info');

describe('TypeInfo Module', () => {
  describe('TypeInfo.Type enumeration', () => {
    it('should have all expected type constants', () => {
      // Assert
      expect(TypeInfo.Type.Class).toBe(0);
      expect(TypeInfo.Type.Function).toBe(1);
      expect(TypeInfo.Type.Number).toBe(2);
      expect(TypeInfo.Type.String).toBe(3);
      expect(TypeInfo.Type.Boolean).toBe(4);
      expect(TypeInfo.Type.Array).toBe(5);
      expect(TypeInfo.Type.Object).toBe(6);
      expect(TypeInfo.Type.Undefined).toBe(7);
      expect(TypeInfo.Type.Null).toBe(8);
      expect(TypeInfo.Type.Any).toBe(9);
    });

    it('should have corresponding type text maps', () => {
      // Assert
      expect(TypeInfo.typeTextMap).toEqual([
        'Class', 'Function', 'Number', 'String', 'Boolean',
        'Array', 'Object', 'Undefined', 'Null', 'Any'
      ]);
      
      expect(TypeInfo.typeTextMapLowerCase).toEqual([
        'class', 'function', 'number', 'string', 'boolean',
        'array', 'object', 'undefined', 'null', 'any'
      ]);
    });
  });

  describe('TypeInfo.typeToString', () => {
    it('should return "class" for Class type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Class };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('class');
    });

    it('should return "function" for Function type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Function };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('function');
    });

    it('should return "number" for Number type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Number };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('number');
    });

    it('should return "string" for String type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.String };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('string');
    });

    it('should return "boolean" for Boolean type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Boolean };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('boolean');
    });

    it('should return "array" for Array type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Array };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('array');
    });

    it('should return "object" for Object type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Object };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('object');
    });

    it('should return "undefined" for Undefined type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Undefined };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('undefined');
    });

    it('should return "null" for Null type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Null };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('null');
    });

    it('should return "any" for Any type', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.Any };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('any');
    });

    it('should handle unknown/invalid type gracefully', () => {
      // Arrange
      const typeInfo = { type: 999 }; // Invalid type

      // Act & Assert
      expect(() => TypeInfo.typeToString(typeInfo)).not.toThrow();
    });

    it('should handle typeInfo with value and hasValue properties', () => {
      // Arrange
      const typeInfo = {
        type: TypeInfo.Type.Number,
        value: 42,
        hasValue: true
      };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('number');
    });

    it('should handle typeInfo with only type property', () => {
      // Arrange
      const typeInfo = { type: TypeInfo.Type.String };

      // Act
      const result = TypeInfo.typeToString(typeInfo);

      // Assert
      expect(result).toBe('string');
    });
  });

  describe('TypeInfo creation patterns', () => {
    it('should create valid typeInfo objects', () => {
      // Arrange & Act
      const numberTypeInfo = {
        type: TypeInfo.Type.Number,
        value: 123,
        hasValue: true
      };

      const stringTypeInfo = {
        type: TypeInfo.Type.String,
        value: 'hello',
        hasValue: true
      };

      const unknownTypeInfo = {
        type: TypeInfo.Type.Any,
        value: undefined,
        hasValue: false
      };

      // Assert
      expect(numberTypeInfo.type).toBe(TypeInfo.Type.Number);
      expect(numberTypeInfo.value).toBe(123);
      expect(numberTypeInfo.hasValue).toBe(true);

      expect(stringTypeInfo.type).toBe(TypeInfo.Type.String);
      expect(stringTypeInfo.value).toBe('hello');
      expect(stringTypeInfo.hasValue).toBe(true);

      expect(unknownTypeInfo.type).toBe(TypeInfo.Type.Any);
      expect(unknownTypeInfo.hasValue).toBe(false);
    });
  });
});
