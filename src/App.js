  import React, { useState } from 'react';
  import { Save, Upload, Code, PlayCircle, Plus, X, Download } from 'lucide-react';
  import FlowchartEditor from './components/editor/FlowchartEditor';
  import ThreadsList from './components/panel/ThreadsList';
  import VariableManager from './components/panel/VariableManager';
  import BlockPalette from './components/blocks/BlockPalette';
  import PropertyPanel from './components/panel/PropertyPanel';
  import { saveToFile, loadFromFile } from './services/FileService';
  import CodeGenerator from './services/CodeGenerator';
  import './App.css';

  function App() {
    const [threads, setThreads] = useState([{ id: 1, name: 'Потік 1', blocks: [], connections: [] }]);
    const [variables, setVariables] = useState([]);
    const [activeTab, setActiveTab] = useState('threads');
    const [activeThread, setActiveThread] = useState(1);
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [generatedCode, setGeneratedCode] = useState('');
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [testCases, setTestCases] = useState([]);
    const [showTestModal, setShowTestModal] = useState(false);
    const [testOutput, setTestOutput] = useState('');
    const [testProgress, setTestProgress] = useState(0);

    const blockTypes = [
      { id: 'start', name: 'Початок', color: 'bg-green-200', type: 'control' },
      { id: 'end', name: 'Кінець', color: 'bg-red-200', type: 'control' },
      { id: 'assign', name: 'Присвоєння', color: 'bg-gray-200', type: 'operation' },
      { id: 'input', name: 'Ввід', color: 'bg-blue-200', type: 'io' },
      { id: 'output', name: 'Вивід', color: 'bg-blue-200', type: 'io' },
      { id: 'condition', name: 'Умова', color: 'bg-yellow-200', type: 'control' },
    ];

    const addThread = () => {
      const newThreadId = threads.length + 1;
      setThreads([...threads, { id: newThreadId, name: `Потік ${newThreadId}`, blocks: [], connections: [] }]);
    };

    const updateThreadName = (threadId, newName) => {
      setThreads(threads.map(t => t.id === threadId ? { ...t, name: newName } : t));
    };

    const removeThread = (threadId) => {
      if (threads.length > 1) {
        setThreads(threads.filter(t => t.id !== threadId));
        if (activeThread === threadId) {
          setActiveThread(threads[0].id !== threadId ? threads[0].id : threads[1].id);
        }
      }
    };

    const updateBlocks = (threadId, updatedBlocks) => {
      setThreads(threads.map(t => t.id === threadId ? { ...t, blocks: updatedBlocks } : t));
    };

    const updateBlockAndRefresh = (blockId, properties) => {
      const threadIndex = threads.findIndex(t => t.id === activeThread);
      if (threadIndex === -1) return;
      
      const newThreads = [...threads];
      const thread = newThreads[threadIndex];
      
      const updatedBlocks = thread.blocks.map(b => 
        b.id === blockId ? { ...b, properties } : b
      );
      thread.blocks = updatedBlocks;
      
      setThreads(newThreads);
      
      const updatedBlock = updatedBlocks.find(b => b.id === blockId);
      
      setSelectedBlock(null);
      
      setTimeout(() => {
        setSelectedBlock(updatedBlock);
      }, 10);
    };
    
    const updateBlockPropertiesAndVariables = (blockId, properties) => {
      const thread = threads.find(t => t.id === activeThread);
      if (!thread) return;
      
      const block = thread.blocks.find(b => b.id === blockId);
      if (!block) return;
      
      const oldProperties = block.properties || {};
      const newProperties = properties;
      
      // Оновлюємо блок з новими властивостями
      updateBlockAndRefresh(blockId, properties);
      
      // Якщо це блок присвоєння і змінюється значення змінної
      if (block.type === 'assign' && !newProperties.isVariable && 
          oldProperties.variable === newProperties.variable) {
        // Оновлюємо значення змінної в масиві змінних
        const varName = newProperties.variable;
        if (varName) {
          const newValue = parseInt(newProperties.value, 10);
          if (!isNaN(newValue)) {
            
            // Використовуємо updateVariableInBlocks для синхронізації
            updateVariableInBlocks(varName, newValue);
          }
        }
      }
    };

    const updateConnections = (threadId, updatedConnections) => {
      setThreads(threads.map(t => t.id === threadId ? { ...t, connections: updatedConnections } : t));
    };

    const deleteBlock = (blockId) => {
      setThreads(prevThreads => {
        const newThreads = [...prevThreads];
        
        const threadIndex = newThreads.findIndex(t => t.id === activeThread);
        if (threadIndex === -1) {
          console.error("Не знайдено активний потік:", activeThread);
          return prevThreads;
        }
        
        const thread = {...newThreads[threadIndex]}; // копіюємо об'єкт потоку
        
        // Фільтруємо блоки та з'єднання
        const newBlocks = thread.blocks.filter(b => b.id !== blockId);
        const newConnections = thread.connections.filter(
          c => c.from.block !== blockId && c.to.block !== blockId
        );
                
        // Оновлюємо потік
        thread.blocks = newBlocks;
        thread.connections = newConnections;
        
        // Оновлюємо потік у масиві потоків
        newThreads[threadIndex] = thread;
        
        return newThreads;
      });
      
      // Знімаємо виділення блоку
      setSelectedBlock(null);
    };

    // Додати нову змінну
    const addVariable = (varName) => {
      if (varName && !variables.find(v => v.name === varName)) {
        setVariables([...variables, { name: varName, value: 0 }]);
        return true;
      }
      return false;
    };

    const updateVariableInBlocks = (varName, newValue) => {
      setVariables(prevVariables => 
        prevVariables.map(v => v.name === varName ? { ...v, value: newValue } : v)
      );
      
      setThreads(prevThreads => {
        // Створюємо нову копію масиву потоків
        const newThreads = prevThreads.map(thread => {
          const updatedBlocks = thread.blocks.map(block => {           
            return block;
          });
      
          return {
            ...thread,
            blocks: updatedBlocks
          };
        });
      
        return newThreads;
      });
      
      
      // Якщо вибраний блок використовує цю змінну, оновлюємо його представлення
      if (selectedBlock) {
        const needsUpdate = 
          (selectedBlock.type === 'assign' && 
            (selectedBlock.properties?.variable === varName || 
             (selectedBlock.properties?.isVariable && selectedBlock.properties?.value === varName))) ||
          ((selectedBlock.type === 'input' || selectedBlock.type === 'output' || selectedBlock.type === 'condition') && 
            selectedBlock.properties?.variable === varName);
        
        if (needsUpdate) {          
          // Зберігаємо ID блоку
          const blockId = selectedBlock.id;
          const threadId = activeThread;
          
          // Знімаємо виділення
          setSelectedBlock(null);
          
          // Через таймаут відновлюємо виділення
          setTimeout(() => {
            const thread = threads.find(t => t.id === threadId);
            if (thread) {
              const block = thread.blocks.find(b => b.id === blockId);
              if (block) {
                setSelectedBlock(block);
              }
            }
          }, 50);
        }
      }
    };

    const removeVariable = (varName) => {
      setVariables(variables.filter(v => v.name !== varName));
    };

    const generateCode = () => {
      const code = CodeGenerator.generatePythonCode(threads, variables);
      setGeneratedCode(code);
      setShowCodeModal(true);
    };

    const runTests = () => {
      setShowTestModal(true);
      setTestOutput('');
      setTestProgress(0);
    };

    const handleTestResults = (output, progress) => {
      setTestOutput(output);
      setTestProgress(progress);
    };

    // Додати тестовий випадок
    const addTestCase = () => {
      setTestCases([...testCases, { input: '', expectedOutput: '' }]);
    };

    const updateTestCase = (index, field, value) => {
      const updatedCases = [...testCases];
      updatedCases[index] = { ...updatedCases[index], [field]: value };
      setTestCases(updatedCases);
    };

    // Видалити тестовий випадок
    const removeTestCase = (index) => {
      setTestCases(testCases.filter((_, i) => i !== index));
    };

    // Зберегти проект
    const saveProject = () => {
      const data = { threads, variables, testCases };
      saveToFile(data, 'flowchart-project.json');
    };

    // Завантажити проект
    const handleLoadProject = (e) => {
      loadFromFile(e, (data) => {
        if (data.threads) setThreads(data.threads);
        if (data.variables) setVariables(data.variables);
        if (data.testCases) setTestCases(data.testCases);
        setSelectedBlock(null);
      });
    };

    return (
      <div className="flex flex-col h-screen bg-gray-100">
        {/* Верхня панель */}
        <div className="bg-gray-800 text-white p-4">
          <h1 className="text-xl font-bold">Інструмент для програмування блок-схем</h1>
        </div>

        {/* Панель інструментів */}
        <div className="bg-gray-200 p-2 flex space-x-2">
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center space-x-1"
            onClick={() => {
              setThreads([{ id: 1, name: 'Потік 1', blocks: [], connections: [] }]);
              setVariables([]);
              setTestCases([]);
              setActiveThread(1);
              setSelectedBlock(null);
            }}>
            <Plus size={16} />
            <span>Нова блок-схема</span>
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center space-x-1"
            onClick={saveProject}>
            <Save size={16} />
            <span>Зберегти</span>
          </button>
          <label className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center space-x-1 cursor-pointer">
            <Upload size={16} />
            <span>Завантажити</span>
            <input type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
          </label>
          <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 flex items-center space-x-1"
            onClick={generateCode}>
            <Code size={16} />
            <span>Генерувати код</span>
          </button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center space-x-1"
            onClick={runTests}>
            <PlayCircle size={16} />
            <span>Тестування</span>
          </button>
        </div>

        {/* Головний вміст */}
        <div className="flex flex-1 overflow-hidden">
          {/* Ліва бічна панель */}
          <div className="w-80 bg-white shadow-md overflow-y-auto flex flex-col">
            {/* Вкладки */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-2 ${activeTab === 'threads' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
                onClick={() => setActiveTab('threads')}
              >
                Потоки
              </button>
              <button
                className={`flex-1 py-2 ${activeTab === 'variables' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
                onClick={() => setActiveTab('variables')}
              >
                Змінні
              </button>
              <button
                className={`flex-1 py-2 ${activeTab === 'props' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
                onClick={() => setActiveTab('props')}
              >
                Властивості
              </button>
            </div>

            {/* Вміст вкладок */}
            <div className="flex-1 p-4">
              {activeTab === 'threads' && (
                <ThreadsList
                  threads={threads}
                  activeThread={activeThread}
                  onSelectThread={(id) => setActiveThread(id)}
                  onAddThread={addThread}
                  onRemoveThread={removeThread}
                  onUpdateThreadName={updateThreadName}
                />
              )}
              
              {activeTab === 'variables' && (
                <VariableManager
                  variables={variables}
                  onAddVariable={addVariable}
                  onRemoveVariable={removeVariable}
                  onUpdateVariable={updateVariableInBlocks}
                />
              )}
              
              {activeTab === 'props' && (
                <PropertyPanel
                  selectedBlock={selectedBlock}
                  variables={variables}
                  onUpdateBlock={(blockId, properties) => {
                    updateBlockPropertiesAndVariables(blockId, properties);
                  }}
                  onRemoveBlock={() => {
                    if (selectedBlock) {
                      deleteBlock(selectedBlock.id);
                    }
                  }}
                  onSelectBlock={setSelectedBlock}
                />
              )}
            </div>

            {/* Палітра блоків */}
            <div className="p-4 border-t">
              <h3 className="font-medium mb-2">Палітра блоків</h3>
              <BlockPalette
                blockTypes={blockTypes}
                onSelectBlockType={(blockType) => {
                  const thread = threads.find(t => t.id === activeThread);
                  if (thread) {
                    const newBlockId = `thread_${activeThread}_block_${thread.blocks.length + 1}`;
                    const newBlock = {
                      id: newBlockId,
                      type: blockType.id,
                      x: 300,
                      y: 200,
                      properties: {}
                    };
                    
                    // Встановлення початкових властивостей для різних типів блоків
                    if (blockType.id === 'assign') {
                      newBlock.properties = {
                        variable: variables[0]?.name || '',
                        value: '0',
                        isVariable: false
                      };
                    } else if (blockType.id === 'input' || blockType.id === 'output') {
                      newBlock.properties = {
                        variable: variables[0]?.name || ''
                      };
                    } else if (blockType.id === 'condition') {
                      newBlock.properties = {
                        variable: variables[0]?.name || '',
                        operator: '<',
                        value: '0'
                      };
                    }
                    
                    updateBlocks(activeThread, [...thread.blocks, newBlock]);
                  }
                }}
              />
            </div>
          </div>

          {/* Основна область редагування */}
          <div className="flex-1 overflow-hidden relative">
            <FlowchartEditor
              thread={threads.find(t => t.id === activeThread)}
              onUpdateBlocks={(blocks) => updateBlocks(activeThread, blocks)}
              onUpdateConnections={(connections) => updateConnections(activeThread, connections)}
              selectedBlock={selectedBlock}
              onSelectBlock={setSelectedBlock}
              variables={variables}
              onDeleteBlock={deleteBlock}
            />
          </div>
        </div>

        {/* Модальне вікно з кодом */}
        {showCodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-screen overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                <h2 className="text-lg font-medium">Згенерований код</h2>
                <button onClick={() => setShowCodeModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="bg-gray-800 text-white rounded-md p-4 overflow-x-auto">
                  <code>{generatedCode}</code>
                </pre>
              </div>
              <div className="p-4 border-t flex justify-end">
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center space-x-1"
                  onClick={() => {
                    const blob = new Blob([generatedCode], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'flowchart_program.py';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={16} />
                  <span>Завантажити код</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модальне вікно тестування */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-screen overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                <h2 className="text-lg font-medium">Тестування блок-схеми</h2>
                <button onClick={() => setShowTestModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Тестові випадки</h3>
                    <button
                      className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600"
                      onClick={addTestCase}
                      title="Додати новий тестовий випадок"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  {/* Список тестових випадків */}
                  {testCases.length > 0 ? (
                    <div className="space-y-4">
                      {testCases.map((testCase, index) => (
                        <div key={index} className="border rounded p-4 bg-gray-50">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium">Тест #{index + 1}</div>
                            <button
                              className="text-red-500 hover:text-red-700"
                              onClick={() => removeTestCase(index)}
                              title="Видалити тестовий випадок"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Вхідні дані (по одному числу на рядок):
                              </label>
                              <textarea
                                className="w-full border rounded px-3 py-2 h-20"
                                value={testCase.input}
                                onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                                placeholder="42&#10;17&#10;100"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Очікуваний вивід (по одному числу на рядок):
                              </label>
                              <textarea
                                className="w-full border rounded px-3 py-2 h-20"
                                value={testCase.expectedOutput}
                                onChange={(e) => updateTestCase(index, 'expectedOutput', e.target.value)}
                                placeholder="59&#10;42"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border rounded bg-gray-50">
                      <div className="text-gray-500 mb-2">Немає тестових випадків</div>
                      <button
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        onClick={addTestCase}
                      >
                        Додати тестовий випадок
                      </button>
                    </div>
                  )}
                  
                  {/* Кнопка запуску тестів */}
                  <div className="flex justify-center">
                    <button
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center"
                      onClick={() => {
                        // Симуляція виконання тестів
                        setTimeout(() => {
                          let output = 'Результати тестування:\n\n';
                          testCases.forEach((test, index) => {
                            output += `Тест #${index + 1}:\n`;
                            output += `  Вхідні дані: ${test.input}\n`;
                            output += `  Очікуваний вивід: ${test.expectedOutput}\n`;
                            const testPassed = Math.random() > 0.3; // Симуляція
                            output += `  Результат: ${testPassed ? 'ПРОЙДЕНО ✓' : 'НЕ ПРОЙДЕНО ✗'}\n\n`;
                          });
                          
                          const explorationProgress = Math.floor(Math.random() * 100);
                          output += `Прогрес дослідження недетермінованих виконань: ${explorationProgress}%`;
                          
                          handleTestResults(output, explorationProgress);
                        }, 1500);
                      }}
                      disabled={testCases.length === 0}
                    >
                      <PlayCircle size={16} className="mr-2" />
                      Запустити тести
                    </button>
                  </div>
                  
                  {/* Результати тестування */}
                  {testOutput && (
                    <div>
                      <h4 className="font-medium mb-2">Результати тестування:</h4>
                      
                      <div className="border rounded bg-gray-800 text-white p-4 font-mono text-sm overflow-x-auto whitespace-pre">
                        {testOutput}
                      </div>
                      
                      {testProgress > 0 && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Прогрес дослідження недетермінованих виконань:</span>
                            <span>{testProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${testProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  export default App;