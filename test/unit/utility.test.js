const Utility = require('../../server/src/services/utility');
const Ast = require('../../server/src/ast/ast');

// Mock Ast.findInnermostNodeOfAnyKind to verify what offset is passed
jest.mock('../../server/src/ast/ast', () => ({
    findInnermostNodeOfAnyKind: jest.fn(),
    asts: {},
}));

describe('Utility.findFocusedNode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should use getPositionOfLineAndCharacter to calculate offset', () => {
        const mockAst = {
            getPositionOfLineAndCharacter: jest.fn().mockReturnValue(123),
        };
        const position = { line: 1, character: 5 };

        Utility.findFocusedNode(mockAst, position);

        expect(mockAst.getPositionOfLineAndCharacter).toHaveBeenCalledWith(
            1,
            5
        );
        expect(Ast.findInnermostNodeOfAnyKind).toHaveBeenCalledWith(
            mockAst,
            123
        );
    });

    it('should throw error if getPositionOfLineAndCharacter is missing', () => {
        const mockAst = {}; // No getPositionOfLineAndCharacter
        const position = { line: 1, character: 5 };

        expect(() => {
            Utility.findFocusedNode(mockAst, position);
        }).toThrow('AST must implement getPositionOfLineAndCharacter');
    });
});
