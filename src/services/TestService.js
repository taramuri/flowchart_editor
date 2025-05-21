import { saveAs } from 'file-saver';
import CodeGenerator from './CodeGenerator';

class TestService {
  static cancelExploration = false;
  
  static async runTests(threads, variables, testCases, maxOperations = 10, onProgress = null) {
    this.cancelExploration = false;
    
    if (!testCases || testCases.length === 0) {
      return {
        output: "Немає тестових випадків для виконання.",
        progress: 0
      };
    }
    
    let output = "Результати тестування:\n\n";
    let totalProgress = 0;
    let passedTests = 0;
    let totalTests = testCases.length;
    
    const activeThreads = this.getActiveThreads(threads);
    const isMultithreaded = activeThreads.length > 1;
    
    console.log(`Активні потоки: ${activeThreads.length}`);
    console.log(`Багатопоточний режим: ${isMultithreaded}`);
    
    if (isMultithreaded) {
      console.log("Потоки:", activeThreads.map(t => t.name));
    }
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      // Додаємо інформацію про тест
      let testOutput = `Тест #${i + 1}:\n` +
                       `  Вхідні дані: ${testCase.input.trim()}\n` +
                       `  Очікуваний вивід: ${testCase.expectedOutput.trim()}\n`;
      
      const currentOutput = output + testOutput;
      if (onProgress) {
        const shouldStop = onProgress(currentOutput, totalProgress);
        if (shouldStop) {
          this.cancelExploration = true;
        }
      }
      
      let result;
      
      if (isMultithreaded) {
        result = await this.executeMultithreadedTest(
          threads,
          variables,
          testCase.input.trim(),
          testCase.expectedOutput.trim(),
          maxOperations
        );
      } else {
        result = await this.executeNondeterministicTest(
          threads,
          variables,
          testCase.input.trim(),
          testCase.expectedOutput.trim(),
          maxOperations
        );
      }
      
      if (result.passed) {
        passedTests++;
      }
      
      if (isMultithreaded && result.threadResults && result.threadResults.length > 0) {
        testOutput += `  Результати по потокам:\n`;
        
        for (let j = 0; j < result.threadResults.length; j++) {
          const threadResult = result.threadResults[j];
          testOutput += `    Потік ${j + 1} (${activeThreads[j].name}): ${threadResult.passed ? 'ПРОЙДЕНО ✓' : 'НЕ ПРОЙДЕНО ✗'}\n`;
          testOutput += `      Вивід: ${threadResult.output || 'немає виводу'}\n`;
        }
      }
      
      const passPercent = isMultithreaded && result.threadResults
        ? (result.threadResults.filter(t => t.passed).length / result.threadResults.length * 100).toFixed(0)
        : (result.passed ? 100 : 0);
      
      testOutput += this.cancelExploration 
        ? `  Результат: відсоток проходження ${passPercent}% (ТЕСТУВАННЯ ПЕРЕРВАНО)\n`
        : `  Результат: відсоток проходження ${passPercent}%\n`;
      
      testOutput += `  Перевірено ${result.explored} з ${result.totalPossible} можливих варіантів виконання\n\n`;
      
      output += testOutput;
      
      totalProgress = result.progress;
      if (onProgress) {
        const shouldStop = onProgress(output, totalProgress);
        if (shouldStop) {
          this.cancelExploration = true;
          break;
        }
      }
    }
    
    const passRate = (passedTests / totalTests) * 100;
    output += `\nЗагальна статистика: пройдено ${passedTests} з ${totalTests} тестів (${passRate.toFixed(2)}%)\n`;
    
    return {
      output,
      progress: totalProgress
    };
  }
  
  static cancelTesting() {
    this.cancelExploration = true;
  }
  
  static async executeMultithreadedTest(threads, variables, input, expectedOutput, maxOperations) {
    console.log("Виконуємо багатопоточний тест");
    
    const activeThreads = this.getActiveThreads(threads);
    
    const memory = {};
    variables.forEach(v => {
      memory[v.name] = v.value;
    });
    
    const inputLines = input.split('\n');
    
    const threadResults = [];
    
    for (let i = 0; i < activeThreads.length; i++) {
      console.log(`Виконання потоку ${i + 1}: ${activeThreads[i].name}`);
      
      const threadMemory = { ...memory };
      
      const threadResult = await this.executeThreadFullExecution(
        activeThreads[i],
        threadMemory,
        inputLines
      );
      
      const normalizedThreadOutput = threadResult.output.trim().replace(/\s+/g, '');
      const normalizedExpected = expectedOutput.trim().replace(/\s+/g, '');
      const threadPassed = normalizedThreadOutput === normalizedExpected;
      
      threadResults.push({
        threadId: activeThreads[i].id,
        threadName: activeThreads[i].name,
        output: threadResult.output.trim(),
        expectedOutput: expectedOutput.trim(),
        passed: threadPassed
      });
      
      console.log(`Потік ${i + 1} (${activeThreads[i].name}): ${threadPassed ? 'пройшов' : 'не пройшов'} тест`);
      console.log(`Вивід потоку: "${threadResult.output.trim()}"`);
      console.log(`Очікуваний вивід: "${expectedOutput.trim()}"`);
    }
    
    const passed = threadResults.some(result => result.passed);
    
    const passedThreadsCount = threadResults.filter(result => result.passed).length;
    
    console.log(`Загальний результат тесту: пройшло ${passedThreadsCount} з ${activeThreads.length} потоків`);
    
    return {
      passed: passed,
      explored: activeThreads.length,
      totalPossible: activeThreads.length,
      progress: (passedThreadsCount / activeThreads.length) * 100,
      threadResults
    };
  }
  
  static async executeNondeterministicTest(threads, variables, input, expectedOutput, maxOperations) {
    const activeThreads = this.getActiveThreads(threads);
    
    const memory = {};
    variables.forEach(v => {
      memory[v.name] = v.value;
    });
    
    if (activeThreads.length <= 1) {
      let result = { passed: false, totalPossible: 1, explored: 1, progress: 100 };
      
      if (activeThreads.length === 1) {
        const thread = activeThreads[0];
        const threadResult = await this.executeThreadFullExecution(
          thread, {...memory}, input.split('\n')
        );
        
        const normalizedOutput = threadResult.output.trim().replace(/\s+/g, '');
        const normalizedExpected = expectedOutput.trim().replace(/\s+/g, '');
        result.passed = normalizedOutput === normalizedExpected;

        console.log(`Thread execution complete.`);
        console.log(`Input: ${input}`);
        console.log(`Actual output (raw): "${threadResult.output}"`);
        console.log(`Actual output (trimmed): "${threadResult.output.trim()}"`);
        console.log(`Actual output (normalized): "${normalizedOutput}"`);
        console.log(`Expected output: "${expectedOutput}"`);
        console.log(`Expected output (normalized): "${normalizedExpected}"`);
        console.log(`Passed: ${normalizedOutput === normalizedExpected}`);
      }
      
      return result;
    }
    
    const stateGraphs = this.buildStateGraphs(activeThreads);
    
    const inputLines = input.split('\n');
    const initialState = {
      memory: {...memory},
      threadStates: activeThreads.map(() => ({ blockId: null, step: 0 })),
      inputIndex: 0,
      output: "",
      path: [],
      operationCount: 0
    };
    
    const possibleExecutions = activeThreads.length > 0 ? 
    Math.pow(activeThreads.length, maxOperations) : 1;
    
    const results = await this.exploreExecutions(
      activeThreads,
      stateGraphs,
      initialState,
      inputLines,
      expectedOutput,
      maxOperations
    );
    
    return {
      passed: results.passed,
      explored: Math.max(1, results.explored),
      totalPossible: possibleExecutions,
      progress: possibleExecutions > 0 ? 
      (results.explored / possibleExecutions) * 100 : 
      results.passed ? 100 : 0
    };
  }
  
  static async exploreExecutions(activeThreads, stateGraphs, initialState, inputLines, expectedOutput, maxOperations) {
    const frontier = [initialState];
    const visited = new Set();
    let explored = 0;
    let passed = false;
    
    for (let i = 0; i < activeThreads.length; i++) {
      const startBlock = activeThreads[i].blocks.find(b => b.type === 'start');
      if (startBlock) {
        initialState.threadStates[i].blockId = startBlock.id;
      }
    }
    
    while (frontier.length > 0 && !this.cancelExploration) {
      const currentState = frontier.pop();
      
      const stateKey = this.getStateKey(currentState);
      
      if (visited.has(stateKey)) {
        continue;
      }
      
      visited.add(stateKey);
      explored++;
      
      const normalizedStateOutput = currentState.output.trim().replace(/\s+/g, '');
      const normalizedStateExpected = expectedOutput.trim().replace(/\s+/g, '');
      if (normalizedStateOutput === normalizedStateExpected) {
        passed = true;
      }
      
      if (currentState.operationCount >= maxOperations) {
        continue;
      }
      
      for (let threadIndex = 0; threadIndex < activeThreads.length; threadIndex++) {
        const threadState = currentState.threadStates[threadIndex];
        
        if (!threadState.blockId) {
          continue;
        }
        
        const thread = activeThreads[threadIndex];
        const block = thread.blocks.find(b => b.id === threadState.blockId);
        
        if (!block) {
          continue;
        }
        
        const nextState = this.executeBlockStep(
          threadIndex,
          block,
          {...currentState},
          thread.connections,
          inputLines
        );
        
        if (nextState) {
          frontier.push(nextState);
        }
      }
      
      if (explored % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return {
      passed,
      explored
    };
  }
  
  static executeBlockStep(threadIndex, block, state, connections, inputLines) {
    const newState = {
      memory: {...state.memory},
      threadStates: [...state.threadStates],
      inputIndex: state.inputIndex,
      output: state.output,
      path: [...state.path, `Thread ${threadIndex + 1}: ${block.type}`],
      operationCount: state.operationCount + 1
    };
    
    newState.threadStates[threadIndex] = {...newState.threadStates[threadIndex]};
    
    switch (block.type) {
      case 'start':
        break;
        
      case 'end':
        newState.threadStates[threadIndex].blockId = null;
        return newState;
        
      case 'input':
        if (block.properties && block.properties.variable) {
          const varName = block.properties.variable;
          
          if (newState.inputIndex < inputLines.length) {
            try {
              const value = parseInt(inputLines[newState.inputIndex], 10);
              newState.memory[varName] = value;
              newState.inputIndex++;
            } catch (e) {
              newState.memory[varName] = 0;
            }
          }
        }
        break;
        
        case 'output':
            if (block.properties && block.properties.variable) {
              const varName = block.properties.variable;
              const value = newState.memory[varName] !== undefined ? newState.memory[varName] : 0;
              
              if (newState.output === "") {
                newState.output = `${value}`;
              } else {
                newState.output += `\n${value}`;
              }
            }
            break;
        
      case 'assign':
        if (block.properties) {
          const varName = block.properties.variable;
          
          if (block.properties.isVariable) {
            const sourceVarName = block.properties.value;
            const value = newState.memory[sourceVarName] !== undefined ? newState.memory[sourceVarName] : 0;
            newState.memory[varName] = value;
          } else {
            const value = parseInt(block.properties.value, 10);
            newState.memory[varName] = isNaN(value) ? 0 : value;
          }
        }
        break;
        
      case 'condition':
        if (block.properties) {
          const varName = block.properties.variable;
          const leftValue = newState.memory[varName] !== undefined ? newState.memory[varName] : 0;
          const rightValue = parseInt(block.properties.value, 10);
          const operator = block.properties.operator || '==';
          
          let conditionMet = false;
          
          switch (operator) {
            case '<':
              conditionMet = leftValue < rightValue;
              break;
            case '<=':
              conditionMet = leftValue <= rightValue;
              break;
            case '>':
              conditionMet = leftValue > rightValue;
              break;
            case '>=':
              conditionMet = leftValue >= rightValue;
              break;
            case '==':
              conditionMet = leftValue === rightValue;
              break;
            case '!=':
              conditionMet = leftValue !== rightValue;
              break;
            case '%':
              conditionMet = leftValue % rightValue === 0;
              break;
            case '!%':
              conditionMet = leftValue % rightValue !== 0;
              break;
          }
          
          const connection = connections.find(conn => conn.from.block === block.id);
        
          if (connection) {
            if (conditionMet && connection.from.position === 'true') {
              newState.threadStates[threadIndex].blockId = connection.to.block;
              return newState;
            } else if (!conditionMet && connection.from.position === 'false') {
              newState.threadStates[threadIndex].blockId = connection.to.block;
              return newState;
            }
          }
          
          newState.threadStates[threadIndex].blockId = null;
          return newState;
        }
        break;
    }
    
    const connection = connections.find(conn => 
      conn.from.block === block.id && conn.from.position === 'next'
    );
    
    if (connection) {
      newState.threadStates[threadIndex].blockId = connection.to.block;
    } else {
      newState.threadStates[threadIndex].blockId = null;
    }
    
    return newState;
  }
  
  static getStateKey(state) {
    const memoryKey = JSON.stringify(state.memory);
    const threadKey = state.threadStates.map(ts => ts.blockId || "null").join("|");
    const ioKey = `${state.inputIndex}|${state.output.length}`;
    
    return `${memoryKey}|${threadKey}|${ioKey}`;
  }
  
  static buildStateGraphs(threads) {
    const stateGraphs = [];
    
    for (const thread of threads) {
      const stateGraph = {};
      
      for (const block of thread.blocks) {
        stateGraph[block.id] = {
          type: block.type,
          next: []
        };
      }
      
      for (const connection of thread.connections) {
        const fromBlock = connection.from.block;
        const toBlock = connection.to.block;
        const position = connection.from.position;
        
        if (stateGraph[fromBlock]) {
          stateGraph[fromBlock].next.push({
            to: toBlock,
            position
          });
        }
      }
      
      stateGraphs.push(stateGraph);
    }
    
    return stateGraphs;
  }
  
  static async executeThreadFullExecution(thread, memory, inputLines) {
    let output = "";
    let inputIndex = 0;
    
    const startBlock = thread.blocks.find(b => b.type === 'start');
    if (!startBlock) return { output: "", memory };
    
    const connections = {};
    thread.connections.forEach(conn => {
      if (!connections[conn.from.block]) {
        connections[conn.from.block] = {};
      }
      connections[conn.from.block][conn.from.position] = conn.to.block;
    });
    
    let currentBlockId = startBlock.id;
    let steps = 0;
    const maxSteps = 1000;
    
    while (currentBlockId && steps < maxSteps) {
      steps++;
      
      const block = thread.blocks.find(b => b.id === currentBlockId);
      if (!block) break;
      
      switch (block.type) {
        case 'start':
          break;
          
        case 'end':
          currentBlockId = null;
          continue;
          
        case 'input':
          if (block.properties && block.properties.variable) {
            const varName = block.properties.variable;
            
            if (inputIndex < inputLines.length) {
              try {
                const value = parseInt(inputLines[inputIndex], 10);
                memory[varName] = value;
                inputIndex++;
              } catch (e) {
                memory[varName] = 0;
              }
            }
          }
          break;
          
          case 'output':
            if (block.properties && block.properties.variable) {
              const varName = block.properties.variable;
              const value = memory[varName] !== undefined ? memory[varName] : 0;
              
              if (output === "") {
                output = `${value}`;
              } else {
                output += `\n${value}`;
              }
            }
            break;
          
        case 'assign':
          if (block.properties) {
            const varName = block.properties.variable;
            
            if (block.properties.isVariable) {
              const sourceVarName = block.properties.value;
              const value = memory[sourceVarName] !== undefined ? memory[sourceVarName] : 0;
              memory[varName] = value;
            } else {
              const value = parseInt(block.properties.value, 10);
              memory[varName] = isNaN(value) ? 0 : value;
            }
          }
          break;
          
        case 'condition':
          if (block.properties) {
            const varName = block.properties.variable;
            const leftValue = memory[varName] !== undefined ? memory[varName] : 0;
            const rightValue = parseInt(block.properties.value, 10);
            const operator = block.properties.operator || '==';
            
            let conditionMet = false;
            
            switch (operator) {
              case '<':
                conditionMet = leftValue < rightValue;
                break;
              case '<=':
                conditionMet = leftValue <= rightValue;
                break;
              case '>':
                conditionMet = leftValue > rightValue;
                break;
              case '>=':
                conditionMet = leftValue >= rightValue;
                break;
              case '==':
                conditionMet = leftValue === rightValue;
                break;
              case '!=':
                conditionMet = leftValue !== rightValue;
                break;
              case '%':
                conditionMet = leftValue % rightValue === 0;
                break;
              case '!%':
                conditionMet = leftValue % rightValue !== 0;
                break;
            }
            
            if (conditionMet) {
              if (connections[block.id] && connections[block.id].true) {
                currentBlockId = connections[block.id].true;
                continue;
              }
            } else {
              if (connections[block.id] && connections[block.id].false) {
                currentBlockId = connections[block.id].false;
                continue;
              }
            }
          }
          break;
      }
      
      if (connections[currentBlockId] && connections[currentBlockId].next) {
        currentBlockId = connections[currentBlockId].next;
      } else {
        currentBlockId = null;
      }
    }
    
    return {
      output,
      memory
    };
  }
  
  static getActiveThreads(threads) {
    return threads.filter(thread => {
      return thread.blocks && 
             thread.blocks.length > 0 && 
             thread.blocks.some(block => block.type === 'start');
    });
  }
  
  static analyzeThreads(threads, variables) {
    const threadGraphs = [];
    
    threads.forEach(thread => {
      if (!thread.blocks || thread.blocks.length === 0) {
        return;
      }
      
      const operations = [];
      
      thread.blocks.forEach(block => {
        if (block.type === 'assign' || block.type === 'input' || block.type === 'output' || block.type === 'condition') {
          operations.push({
            id: block.id,
            type: block.type,
            properties: block.properties || {}
          });
        }
      });
      
      const threadGraph = {
        id: thread.id,
        name: thread.name,
        operations
      };
      
      threadGraphs.push(threadGraph);
    });
    
    return threadGraphs;
  }
  
  static saveTestLogs(output) {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      saveAs(blob, `test-results-${timestamp}.txt`);
    } catch (e) {
      console.error('Помилка збереження логів тестування:', e);
    }
  }
}

export default TestService;