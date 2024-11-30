import crypto from 'crypto';
import inquirer from 'inquirer';

const allDices = [];
let leftDices = [];
let compSelectedDice = null;
let playerSelectedDice = null;

const isValidConfig = (config) => {
    const numbers = config.split(',').map(num => num.trim());
    if (numbers.length !== 6) {
        return 'Error: Each argument should contain exactly 6 comma-separated integers. Example: "1,2,3,4,5,6"';
    }
    for (let num of numbers) {
        if (isNaN(num) || !Number.isInteger(Number(num))) {
            return `Error: All values must be integers. Invalid value: "${num}"`;
        }
    }
    return null;
}


const correctArgs = () => {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log('Error: You must provide at least 3 dice configurations, each containing 6 comma-separated integers.');
        console.log('Example of correct usage: node task3.js "1,2,3,4,5,6" "6,5,4,3,2,1" "2,3,4,5,6,1"');
        process.exit(1);
    }
    for (let i = 0; i < args.length; i++) {
        const errorMessage = isValidConfig(args[i]);
        if (errorMessage) {
            console.log(`Argument ${i + 1}: ${errorMessage}`);
            process.exit(1);
        }
        const configArray = args[i].split(',').map(num => parseInt(num.trim(), 10));
        allDices.push(configArray);
    }
    leftDices = [...allDices]
}
correctArgs();

function generateRandomKey(lengthInBytes) {
    const randomBytes = crypto.randomBytes(lengthInBytes);
    return randomBytes.toString('base64');
}

const randomKey = generateRandomKey(32);

function randomNum(x, y) {
    return crypto.randomInt(x, y);
}

function computeHMAC(message, secretKey) {
    const hmac = crypto.createHmac('sha3-256', secretKey);
    hmac.update(message);
    return hmac.digest('base64');
}

const createRangeArray = (maxValue) => {
    return Array.from({
        length: maxValue + 1
    },
    (_, index) => ({
        name: `${index} - ${index}`,
        value: index
    }))
}

const guessingNum = createRangeArray(1);
const choosingMod = createRangeArray(5)

const helpExit = [
    { name: 'X - exit', value: 'exit' },
    { name: '? - help', value: 'help' },
];
const calculateWinProbability = (playerDice, computerDice) => {
    let playerWins = 0;
    let computerWins = 0;
    let draws = 0;

    for (let playerSide of playerDice) {
        for (let computerSide of computerDice) {
            if (playerSide > computerSide) {
                playerWins++;
            } else if (playerSide < computerSide) {
                computerWins++;
            } else {
                draws++;
            }
        }
    }

    const totalOutcomes = playerDice.length * computerDice.length;
    const playerWinProbability = playerWins / totalOutcomes;
    const computerWinProbability = computerWins / totalOutcomes;
    const drawProbability = draws / totalOutcomes;

    return { playerWinProbability, computerWinProbability, drawProbability };
};
const displayProbabilityTable = () => {
    console.log('+----------------+--------------------+--------------------+--------------------+');
    console.log(`| User dice v   | ${allDices[0]}      | ${allDices[1]}        | ${allDices[2]}        |`);
    console.log('+----------------+--------------------+--------------------+--------------------+');

    for (let i = 0; i < allDices.length; i++) {
        let row = `| ${allDices[i].join(',')} |`;
        for (let j = 0; j < allDices.length; j++) {
            const { playerWinProbability } = calculateWinProbability(allDices[i], allDices[j]);
            row += ` ${playerWinProbability.toFixed(4)} |`;
        }
        console.log(row);
        console.log('+----------------+--------------------+--------------------+--------------------+');
    }
};

const handleCommand = (command) => {
    switch (command) {
        case 'exit':
            console.log('Exiting the game...');
            process.exit();
        case 'help':
            console.log('Displaying help...');
            displayProbabilityTable();
            process.exit();
    }
};
const dicesWithNames = allDices.map((dice, index) => {
    return {
    name: `${index} - ${dice.join(',')}`, 
    value: index
    }
});

const allGuess = guessingNum.concat(helpExit);
const playerGuess = dicesWithNames.concat(helpExit);
const modGuess = choosingMod.concat(helpExit);

function getDicesOptions() {
    const leftDicesWithName = leftDices.map((dice, index) => {
        return {
        name: `${index} - ${dice.join(',')}`, 
        value: index
        }
    });
    return [...leftDicesWithName, ...helpExit]
}

const handleUserSelection = async () => {
    const { guessing } = await inquirer.prompt({
        type: 'list',
        name: 'guessing',
        message: 'Try to guess my selection.',
        choices: allGuess
    });
    handleCommand(guessing);
    const selectedResult = parseInt(guessing);
    return selectedResult;
}

const updateLeftDices = (selectedDiceIndex) => {
    leftDices = leftDices.filter((dice, idx) => idx !== selectedDiceIndex);
};

function generateHMACWithRandomChoice(min, max, randomKey) {
    const randomChoice = randomNum(min, max);
    const hmac = computeHMAC(randomChoice.toString(), randomKey);
    console.log(`I selected a random value in the range ${min}..${max - 1}`);
    console.log(`(HMAC: ${hmac})`);
    return { randomChoice, hmac };
}

const isPlayerMovesFirst = async () => {
    console.log('Let`s determine who makes the first move.');
    const { randomChoice } = generateHMACWithRandomChoice(0, 2, randomKey);

    const selectedResult = await handleUserSelection();
    console.log(`Your selection: ${selectedResult}`)
    console.log(`My selection: ${randomChoice} (KEY: ${randomKey})`);
    return randomChoice === selectedResult

}

const numberModul = async() => {
    const { randomChoice } = generateHMACWithRandomChoice(0, 6, randomKey);
    const { playerThrow } = await inquirer.prompt({
        type: 'list',
        name: 'playerThrow',
        message: 'Add your number modulo 6.',
        choices: modGuess,
        pageSize: 8
    })
    handleCommand(playerThrow);
    const playerSelectedSideOfDice = parseInt(playerThrow);
    const result = (randomChoice + playerSelectedSideOfDice)%6;
    console.log(`Your selection: ${playerSelectedSideOfDice}`);
    
    console.log(`My number is ${randomChoice} (KEY: ${randomKey})`);
    console.log(`The result is ${randomChoice} + ${playerSelectedSideOfDice} = ${result} (mod 6).`);
    return result;
}


const playerMove = async () => {
    const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'Choose your dice:',
        choices: playerGuess 
    })
    handleCommand(action);
    const chosenDice = parseInt(action);
    playerSelectedDice = allDices[chosenDice];
    console.log(`You chose the [${playerSelectedDice}] dice.`);
    updateLeftDices(chosenDice);

    const { compChooseDice } = await inquirer.prompt({
        type: 'text',
        name: 'compChooseDice',
        message: 'It`s time for my choice dice:',
    })

    const randomCompChoiceIndex = crypto.randomInt(leftDices.length);
    compSelectedDice = leftDices[randomCompChoiceIndex];
    console.log(`And I chose the [${compSelectedDice}] dice.`);

    console.log('It`s time for your throw.')
    return await numberModul();
}

const getDiceFromResult = async (numberFromMod, selectedDice) => {
    if(numberFromMod >= 0 && numberFromMod < selectedDice.length) {
        return selectedDice[numberFromMod];
    } else {
        console.log('Invalid index.');
        return null;
    }
}


const computerMove = async () => {
    const chosenDicesIndex = crypto.randomInt(leftDices.length);
    compSelectedDice = leftDices[chosenDicesIndex];
    console.log(`I make the first move and choose the [${compSelectedDice}] dice.`)
    updateLeftDices(chosenDicesIndex);
    const leftDicesForPlayer = getDicesOptions();
    const { compAction } = await inquirer.prompt({
        type: 'list',
        name: 'compAction',
        message: 'Choose your dice:',
        choices: leftDicesForPlayer
    })
    handleCommand(compAction);
    const playerChoiceIndex = parseInt(compAction);
    playerSelectedDice = leftDices[playerChoiceIndex];

    console.log(`You chose the [${playerSelectedDice}] dice.`);
    console.log('It`s time for my throw.')
    return await numberModul();
}

async function determinePlayerChoice(calcNumberModOfPlayerThrow) {
    const selectedIndexOfDice = await getDiceFromResult(calcNumberModOfPlayerThrow, playerSelectedDice)
    return selectedIndexOfDice;
}
async function determineComputerChoice(calcNumberModOfCompThrow) {
    const selectedIndexOfDice = await getDiceFromResult(calcNumberModOfCompThrow, compSelectedDice)
    return selectedIndexOfDice;
}


async function compareThrows(calcNumberModOfPlayerThrow, calcNumberModOfCompThrow) {
    const playerThrow = await determinePlayerChoice(calcNumberModOfPlayerThrow);
    const computerThrow = await determineComputerChoice(calcNumberModOfCompThrow);
    if (playerThrow > computerThrow) {
        console.log(`You win (${playerThrow} > ${computerThrow})!`);
    } else if (playerThrow < computerThrow) {
        console.log(`I win (${playerThrow} < ${computerThrow})!`);
    } else {
        console.log(`It's a draw! (${playerThrow} == ${computerThrow})`);
    }
}

const main = async () => {
    try {
        if(await isPlayerMovesFirst()) {
            const calcNumberModOfPlayerThrow = await playerMove();
            const finalChosenNumByPlayer = await determinePlayerChoice(calcNumberModOfPlayerThrow);
            console.log(`Your throw is: ${finalChosenNumByPlayer}`);
            console.log('It`s time for my throw.')
            const calcNumberModOfCompThrow = await numberModul();
            const finalChosenNum = await determineComputerChoice(calcNumberModOfCompThrow);
            console.log(`My throw is: ${finalChosenNum}`);
            await compareThrows(calcNumberModOfPlayerThrow, calcNumberModOfCompThrow);

        } else {
            const calcNumberModOfCompThrow = await computerMove();
            const finalChosenNum = await determineComputerChoice(calcNumberModOfCompThrow);
            console.log(`My throw is: ${finalChosenNum}`);
            console.log('It`s time for your throw.')
            const calcNumberModOfPlayerThrow = await numberModul();
            const finalChosenNumByPlayer = await determinePlayerChoice(calcNumberModOfPlayerThrow);
            console.log(`Your throw is: ${finalChosenNumByPlayer}`);
            await compareThrows(calcNumberModOfPlayerThrow, calcNumberModOfCompThrow);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();



