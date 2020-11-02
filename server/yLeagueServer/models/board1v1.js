'use strict'

const board1v1 = function (data) {
    this.data = data;
    this.numberCells = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
    this.sumCells = ['ss', 'ls'];
    this.lowerCells = ['f', 'k', 'q', '8', 'y'];
    this.allCells = this.numberCells.concat(this.sumCells).concat(this.lowerCells);
    this.columns = ['down', 'free', 'up', 'mid', 'x2', 'updown'];

    if (this.data == undefined) {
        this.data = {
            current: {
                noRolls: 0,
                player: 0,
                dice: [],
                hold: [],
                move: 1,
                noPuts: 0,
            },
            values: {},
            ranks: [],
        };
        for (let i = 0; i < this.columns.length; i++) {
            const column = this.columns[i];
            this.data.values[column] = {};
            for (let j = 0; j < this.allCells.length; j++) {
                const cell = this.allCells[j];
                this.data.values[column][cell] = [];
                for (let k = 0; k < 2; k++) {
                    this.data.values[column][cell][k] = null;
                }
            }
        }
    }

    this.getColumns = function () {
        return this.columns;
    };

    this.getCells = function () {
        return this.allCells;
    };

    this.setRanks = function (ranks) {
        this.data.ranks = ranks;
    };

    this.isDone = function () {
        for (let i = 0; i < this.columns.length; i++) {
            const column = this.columns[i];
            for (let j = 0; j < this.allCells.length; j++) {
                const cell = this.allCells[j];
                for (let k = 0; k < 2; k++) {
                    if (this.data.values[column][cell][k] === null) return false;
                }
            }
        }
        return true;
    };

    this.canRoll3rdTime = function () {
        for (let i = 0; i < this.columns.length; i++) {
            const column = this.columns[i];
            if (column === 'x2') continue;
            for (let j = 0; j < this.allCells.length; j++) {
                const cell = this.allCells[j];
                if (this.data.values[column][cell][this.data.current.player] === null) return true;
            }
        }
        return false;
    };

    this.canRoll = function () {
        if (this.canRoll3rdTime()) return this.data.current.noRolls < 3;
        else return this.data.current.noRolls < 2;
    };

    this.recordRoll = function (dice) {
        this.data.current.dice = dice;
        this.data.current.noRolls++;
        this.data.current.move++;
    };

    this.setHold = function (hold) {
        this.data.current.hold = hold;
    };

    this.recordPut = function (column, cell) {
        if (!this.canPut(column, cell)) throw 'invalid put data';
        const scores = this.getScore(column, cell, this.data.current.dice);
        for (let i = 0; i < scores.length; i++) {
            const score = scores[i];
            this.data.values[score.column][score.cell][this.data.current.player] = score.score;
        }
        this.data.current.player = (this.data.current.player + 1) % 2;
        this.data.current.noRolls = 0;
        this.data.current.dice = [];
        this.data.current.hold = [];
        this.data.current.move++;
        this.data.current.noPuts++;
    };

    this.getData = function () {
        return this.data;
    };

    this.getPlayerUpperColumnScore = function (column, player) {
        let columnScore = 0;
        // upper score
        for (let i = 0; i < this.numberCells.length; i++) {
            const score = this.data.values[column][this.numberCells[i]][player];
            if (score !== null && score !== 0) columnScore += score;
        }
        if (columnScore < 60) return columnScore;
        else if (columnScore < 70) columnScore += 30;
        else if (columnScore < 80) columnScore += 50;
        else if (columnScore < 90) columnScore += 100;
        else if (columnScore < 100) columnScore += 200;
        else columnScore += 500;
        return columnScore;
    };

    this.getPlayerColumnScore = function (column, player) {
        // upper score
        let columnScore = this.getPlayerUpperColumnScore(column, player);
        let columnBonus = columnScore >= 90;
        // mid score
        for (let i = 0; i < this.sumCells.length; i++) {
            const score = this.data.values[column][this.sumCells[i]][player];
            if (score === null || score === 0) columnBonus = false;
            else columnScore += score;
        }
        // lower score
        for (let i = 0; i < this.lowerCells.length; i++) {
            const score = this.data.values[column][this.lowerCells[i]][player];
            if (score === null || score === 0) columnBonus = false;
            else columnScore += score;
        }
        return { score: columnScore, bonus: columnBonus };
    };

    this.getPlayerFinalColumnScore = function (column, player) {
        const playerResult = this.getPlayerColumnScore(column, player);
        const op1Result = this.getPlayerColumnScore(column, (player - 1 + 2) % 2);
        let points = 0;
        if (this.getScoreWithBonus(playerResult) > this.getScoreWithBonus(op1Result)) points += this.getPoints(playerResult, op1Result);
        else points -= this.getPoints(op1Result, playerResult);
        return points * this.getColumnRank(column);
    };

    this.getColumnRank = function (column) {
        let colIdx = this.columns.indexOf(column);
        return this.data.ranks[colIdx];
    };

    this.getPlayerFinalScore = function (player) {
        let points = 0;
        for (let i = 0; i < this.columns.length; i++) points += this.getPlayerFinalColumnScore(this.columns[i], player);
        return points;
    };

    this.getTeamFinalScore = function (team) {
        if (team === 1) return this.getPlayerFinalScore(0);
        else return this.getPlayerFinalScore(1);
    };

    this.getPoints = function (high, low) {
        for (let multiplier = 5; multiplier >= 2; multiplier--) {
            if (high.score >= multiplier * low.score) {
                return (this.getScoreWithBonusForMultiplier(high) - this.getScoreWithBonusForMultiplier(low)) * multiplier;
            }
        }
        return this.getScoreWithBonus(high) - this.getScoreWithBonus(low);
    };

    this.getScoreWithBonusForMultiplier = function (result) {
        let score = result.score;
        if (result.bonus) score += 100;
        return score;
    };

    this.getScoreWithBonus = function (result) {
        let score = result.score;
        if (result.bonus) score += 200;
        return score;
    };

    this.canPut = function (column, cell) {
        if (this.isPut(column, cell)) return false;
        if (column === 'free') return true;
        if (column === 'down' && (cell === 'n1' || this.isPut(column, this.cellBefore(cell)))) return true;
        if (column === 'up' && (cell === 'y' || this.isPut(column, this.cellAfter(cell)))) return true;
        if (column === 'mid' && (cell === 'n6' || cell === 'ss' || this.isPut(column, this.cellBefore(cell)) || this.isPut(column, this.cellAfter(cell)))) return true;
        if (column === 'x2' && this.data.current.noRolls <= 2) return true;
        if (column === 'updown' && (this.countColumnFreeCells(column) == this.allCells.length || this.isPut(column, this.cellBefore(cell)) || this.isPut(column, this.cellAfter(cell)))) return true;
        return false;
    };

    this.canPutPlayer = function (column, cell, player) {
        if (this.isPutPlayer(column, cell, player)) return false;
        if (column === 'free') return true;
        if (column === 'down' && (cell === 'n1' || this.isPutPlayer(column, this.cellBefore(cell), player))) return true;
        if (column === 'up' && (cell === 'y' || this.isPutPlayer(column, this.cellAfter(cell), player))) return true;
        if (column === 'mid' && (cell === 'n6' || cell === 'ss' || this.isPutPlayer(column, this.cellBefore(cell), player) || this.isPutPlayer(column, this.cellAfter(cell), player))) return true;
        if (column === 'x2') return false;
        if (column === 'updown' && (this.countColumnFreeCellsPlayer(column, player) == this.allCells.length || this.isPutPlayer(column, this.cellBefore(cell), player) || this.isPutPlayer(column, this.cellAfter(cell), player))) return true;
        return false;
    };

    this.getScore = function (column, cell, dice) {
        if (this.numberCells.indexOf(cell) >= 0) return this.getNumberCellScore(column, cell, dice);
        else if (cell === 'ss') return this.getSmallSumCellScore(column, dice);
        else if (cell === 'ls') return this.getLargeSumCellScore(column, dice);
        else if (cell === 'f') return this.getFullHouseCellScore(column, dice);
        else if (cell === 'k') return this.getFourOfAKindCellScore(column, dice);
        else if (cell === 'q') return this.getStraightCellScore(column, dice);
        else if (cell === '8') return this.getEightCellScore(column, dice);
        else if (cell === 'y') return this.getYamsCellScore(column, dice);
        else throw 'invalid cell';
    };

    this.getNumberCellScore = function (column, cell, dice) {
        const number = parseInt(cell[1]);
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: cell,
                score: number * 5,
            }];
        }
        let sum = 0;
        for (let i = 0; i < dice.length; i++) {
            if (dice[i] === number) sum += number;
        }
        const maxScore = this.getMaxScore(column, cell);
        return [{
            column: column,
            cell: cell,
            score: sum >= maxScore ? sum : 0,
        }];
    };

    this.getSmallSumCellScore = function (column, dice) {
        const sum = this.getDiceSum(dice);
        const maxScore = Math.max(20, this.getMaxScore(column, 'ss'));
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            let maxPossible = 29;
            if (this.isPut(column, 'ls')) {
                maxPossible = this.getPlayerScore(column, 'ls', this.data.current.player) - 1;
            }
            if (maxPossible >= 20) {
                return [{
                    column: column,
                    cell: 'ss',
                    score: maxPossible,
                }];
            }
        }
        let lsValid = true;
        if (this.isPut(column, 'ls')) {
            lsValid = this.getPlayerScore(column, 'ls', this.data.current.player) > sum;
        }
        const valid = sum >= maxScore && lsValid;
        let result = [];
        result.push({
            column: column,
            cell: 'ss',
            score: valid ? sum : 0,
        });
        if (!valid && this.isPut(column, 'ls')) {
            result.push({
                column: column,
                cell: 'ls',
                score: valid ? sum : 0,
            });
        }
        return result;
    };

    this.getLargeSumCellScore = function (column, dice) {
        let ssValid = true;
        if (this.isPut(column, 'ss')) {
            ssValid = this.getPlayerScore(column, 'ss', this.data.current.player) > 0;
        }
        const inverseCount = this.getDiceInverseCount(dice);
        if (ssValid && inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: 'ls',
                score: 30,
            }];
        }
        const sum = this.getDiceSum(dice);
        const maxScore = Math.max(Math.max(20, this.getMaxScore(column, 'ls')), this.getMaxScore(column, 'ss') + 1);
        const valid = ssValid && sum >= maxScore;
        let result = [];
        result.push({
            column: column,
            cell: 'ls',
            score: valid ? sum : 0,
        });
        if (!valid && this.isPut(column, 'ss')) {
            result.push({
                column: column,
                cell: 'ss',
                score: valid ? sum : 0,
            });
        }
        return result;
    };

    this.getFullHouseCellScore = function (column, dice) {
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: 'f',
                score: 50,
            }];
        }
        const valid23 = inverseCount[2].length === 1 && inverseCount[3].length === 1;
        const valid5 = inverseCount[5].length === 1;
        var valid = valid23 || valid5;
        if (!valid) {
            return [{
                column: column,
                cell: 'f',
                score: 0,
            }];
        }
        const score = 20 + (valid23 ? inverseCount[2][0] * 2 + inverseCount[3][0] * 3 : inverseCount[5][0] * 5);
        const maxScore = this.getMaxScore(column, 'f');
        return [{
            column: column,
            cell: 'f',
            score: score >= maxScore ? score : 0,
        }];
    };

    this.getFourOfAKindCellScore = function (column, dice) {
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: 'k',
                score: 54,
            }];
        }
        const valid4 = inverseCount[4].length === 1;
        const valid5 = inverseCount[5].length === 1;
        const valid = valid4 || valid5;
        if (!valid) {
            return [{
                column: column,
                cell: 'k',
                score: 0,
            }];
        }
        const score = 30 + inverseCount[valid4 ? 4 : 5][0] * 4;
        const maxScore = this.getMaxScore(column, 'k');
        return [{
            column: column,
            cell: 'k',
            score: score >= maxScore ? score : 0,
        }];
    };

    this.getStraightCellScore = function (column, dice) {
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: 'q',
                score: 50,
            }];
        }
        const validSmall = inverseCount[1].length === 5 && inverseCount[0].length === 1 && inverseCount[0][0] === 6;
        const validLarge = inverseCount[1].length === 5 && inverseCount[0].length === 1 && inverseCount[0][0] === 1;
        const valid = validSmall || validLarge;
        if (!valid) {
            return [{
                column: column,
                cell: 'q',
                score: 0,
            }];
        }
        const score = validSmall ? 45 : 50;
        const maxScore = this.getMaxScore(column, 'q');
        return [{
            column: column,
            cell: 'q',
            score: score >= maxScore ? score : 0,
        }];
    };

    this.getEightCellScore = function (column, dice) {
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: '8',
                score: 75,
            }];
        }
        const sum = this.getDiceSum(dice);
        const valid = sum <= 8;
        if (!valid) {
            return [{
                column: column,
                cell: '8',
                score: valid ? sum : 0,
            }];
        }
        var score = 60 + (8 - sum) * 5;
        const maxScore = this.getMaxScore(column, '8');
        return [{
            column: column,
            cell: '8',
            score: score >= maxScore ? score : 0,
        }];
    };

    this.getYamsCellScore = function (column, dice) {
        const inverseCount = this.getDiceInverseCount(dice);
        if (inverseCount[5].length === 1 && this.data.current.noRolls === 1) {
            return [{
                column: column,
                cell: 'y',
                score: 100,
            }];
        }
        const valid = inverseCount[5].length === 1;
        if (!valid) {
            return [{
                column: column,
                cell: 'y',
                score: 0,
            }];
        }
        const yamsNumber = inverseCount[5][0];
        const score = 75 + (yamsNumber - 1) * 5;
        const maxScore = this.getMaxScore(column, 'y');
        return [{
            column: column,
            cell: 'y',
            score: score >= maxScore ? score : 0,
        }];
    };

    this.getDiceInverseCount = function (dice) {
        const count = this.getDiceCount(dice);
        let inverseCount = [];
        for (let i = 0; i <= 5; i++) inverseCount[i] = [];
        for (let i = 1; i <= 6; i++) inverseCount[count[i]].push(i);
        return inverseCount;
        
    }

    this.getDiceCount = function (dice) {
        let count = [];
        for (let i = 1; i <= 6; i++) count[i] = 0;
        for (let i = 0; i < dice.length; i++) count[dice[i]]++;
        return count;
    }

    this.getDiceSum = function (dice) {
        let sum = 0;
        for (let i = 0; i < dice.length; i++) {
            sum += dice[i];
        }
        return sum;
    };

    this.getMaxScore = function (column, cell) {
        let max = 0;
        for (let i = 0; i < 2; i++) {
            const score = this.getPlayerScore(column, cell, i);
            if (score > max) max = score;
        }
        return max;
    };

    this.isPut = function (column, cell) {
        return this.isPutPlayer(column, cell, this.data.current.player);
    };

    this.isPutPlayer = function (column, cell, player) {
        return this.data.values[column][cell][player] !== null;
    };

    this.getPlayerScore = function (column, cell, player) {
        let score = this.data.values[column][cell][player];
        if (score === null) score = 0;
        return score;
    };

    this.countColumnFreeCells = function (column) {
        let count = 0;
        for (let i = 0; i < this.allCells.length; i++) {
            if (!this.isPut(column, this.allCells[i])) count++;
        }
        return count;
    };

    this.countColumnFreeCellsPlayer = function (column, player) {
        let count = 0;
        for (let i = 0; i < this.allCells.length; i++) {
            if (!this.isPutPlayer(column, this.allCells[i], player)) count++;
        }
        return count;
    };

    this.cellBefore = function (cell) {
        let idx = this.cellIndex(cell);
        idx = (idx - 1 + this.allCells.length) % this.allCells.length;
        return this.allCells[idx];
    };

    this.cellAfter = function (cell) {
        let idx = this.cellIndex(cell);
        idx = (idx + 1) % this.allCells.length;
        return this.allCells[idx];
    };

    this.cellIndex = function (cell) {
        return this.allCells.indexOf(cell);
    };
}

try {
    module.exports = board1v1;
} catch (e) { }
