const CodeGenerator = {
    generatePythonCode: (threads, variables) => {
      let code = `import threading\nimport time\nimport sys\n\n# Спільні змінні\n`;
      
      // Оголошення спільних змінних
      code += `shared_vars = {\n`;
      variables.forEach(v => {
        code += `    "${v.name}": 0,\n`;
      });
      code += `}\n\n`;
      
      // Локи для безпечного доступу до спільних змінних та вводу/виводу
      code += `# Локи для безпечного доступу до спільних ресурсів\nvar_lock = threading.Lock()\nio_lock = threading.Lock()\n\n`;
      
      // Генерація міток для кожного блоку
      threads.forEach(thread => {
        code += `# Функція для потоку ${thread.id}: ${thread.name}\n`;
        code += `def thread_${thread.id}_function():\n`;
        
        // Якщо немає блоків, повертаємо порожню функцію
        if (thread.blocks.length === 0) {
          code += `    pass\n\n`;
          return;
        }
        
        // Знаходимо початковий блок
        const startBlock = thread.blocks.find(b => b.type === 'start');
        if (!startBlock) {
          code += `    # Попередження: немає початкового блоку\n    pass\n\n`;
          return;
        }
        
        // Визначаємо унікальні мітки для блоків
        const blockLabels = {};
        thread.blocks.forEach(block => {
          blockLabels[block.id] = `label_${block.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        });
        
        // Структура goto реалізована через словник та цикл
        code += `    # Імітація goto через словник функцій\n`;
        code += `    labels = {}\n`;
        
        // Визначаємо функції для кожного блоку
        thread.blocks.forEach(block => {
          code += `    def ${blockLabels[block.id]}():\n`;
          
          switch (block.type) {
            case 'start':
              // Для початкового блоку тільки переходимо до наступного блоку
              // Знаходимо з'єднання для наступного блоку
              const startNextConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'next'
              );
              
              if (startNextConn) {
                code += `        return "${blockLabels[startNextConn.to.block]}"\n`;
              } else {
                code += `        return None  # Немає наступного блоку\n`;
              }
              break;
              
            case 'end':
              // Для кінцевого блоку повертаємо None, що призведе до завершення потоку
              code += `        return None  # Кінець потоку\n`;
              break;
              
            case 'assign':
              // Операція присвоєння
              code += `        with var_lock:  # Блокуємо доступ до спільних змінних\n`;
              
              if (block.properties?.isVariable) {
                // Присвоєння значення іншої змінної
                code += `            shared_vars["${block.properties.variable}"] = shared_vars["${block.properties.value}"]\n`;
              } else {
                // Присвоєння константи
                code += `            shared_vars["${block.properties.variable}"] = ${block.properties.value}\n`;
              }
              
              // Перехід до наступного блоку
              const assignNextConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'next'
              );
              
              if (assignNextConn) {
                code += `        return "${blockLabels[assignNextConn.to.block]}"\n`;
              } else {
                code += `        return None  # Немає наступного блоку\n`;
              }
              break;
              
            case 'input':
              // Операція вводу
              code += `        with io_lock:  # Блокуємо доступ до вводу/виводу\n`;
              code += `            try:\n`;
              code += `                user_input = int(input())\n`;
              code += `                with var_lock:  # Блокуємо доступ до спільних змінних\n`;
              code += `                    shared_vars["${block.properties.variable}"] = user_input\n`;
              code += `            except ValueError:\n`;
              code += `                print("Помилка: введіть ціле число в діапазоні 0..2^31-1")\n`;
              code += `                with var_lock:  # При помилці встановлюємо 0\n`;
              code += `                    shared_vars["${block.properties.variable}"] = 0\n`;
              
              // Перехід до наступного блоку
              const inputNextConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'next'
              );
              
              if (inputNextConn) {
                code += `        return "${blockLabels[inputNextConn.to.block]}"\n`;
              } else {
                code += `        return None  # Немає наступного блоку\n`;
              }
              break;
              
            case 'output':
              // Операція виводу
              code += `        with io_lock:  # Блокуємо доступ до вводу/виводу\n`;
              code += `            with var_lock:  # Блокуємо доступ до спільних змінних\n`;
              code += `                print(shared_vars["${block.properties.variable}"])\n`;
              
              // Перехід до наступного блоку
              const outputNextConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'next'
              );
              
              if (outputNextConn) {
                code += `        return "${blockLabels[outputNextConn.to.block]}"\n`;
              } else {
                code += `        return None  # Немає наступного блоку\n`;
              }
              break;
              
            case 'condition':
              // Операція умови
              code += `        with var_lock:  # Блокуємо доступ до спільних змінних\n`;
              
              // Оператор порівняння
              const operator = block.properties?.operator || '<';
              
              code += `            if shared_vars["${block.properties.variable}"] ${operator} ${block.properties.value}:\n`;
              
              // Перехід для істинної умови
              const trueConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'true'
              );
              
              if (trueConn) {
                code += `                return "${blockLabels[trueConn.to.block]}"\n`;
              } else {
                code += `                pass  # Немає блоку для істинної умови\n`;
              }
              
              code += `            else:\n`;
              
              // Перехід для хибної умови
              const falseConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'false'
              );
              
              if (falseConn) {
                code += `                return "${blockLabels[falseConn.to.block]}"\n`;
              } else {
                code += `                pass  # Немає блоку для хибної умови\n`;
              }
              
              // Якщо немає жодного переходу для умови, переходимо до наступного блоку
              const conditionNextConn = thread.connections.find(c => 
                c.from.block === block.id && c.from.position === 'next'
              );
              
              if (conditionNextConn) {
                code += `            return "${blockLabels[conditionNextConn.to.block]}"\n`;
              } else {
                code += `            return None  # Немає наступного блоку\n`;
              }
              break;
              
            default:
              code += `        pass  # Невідомий тип блоку\n`;
              code += `        return None\n`;
          }
        });
        
        // Додаємо кожну функцію до словника міток
        code += `\n    # Заповнюємо словник міток\n`;
        thread.blocks.forEach(block => {
          code += `    labels["${blockLabels[block.id]}"] = ${blockLabels[block.id]}\n`;
        });
        
        // Реалізуємо виконання блок-схеми через цикл
        code += `\n    # Виконання блок-схеми\n`;
        code += `    next_label = "${blockLabels[startBlock.id]}"\n`;
        code += `    while next_label:\n`;
        code += `        label_func = labels.get(next_label)\n`;
        code += `        if label_func:\n`;
        code += `            next_label = label_func()\n`;
        code += `        else:\n`;
        code += `            break\n\n`;
      });
      
      code += `def main():\n`;
      code += `    # Створення потоків\n`;
      threads.forEach(thread => {
        code += `    thread_${thread.id} = threading.Thread(target=thread_${thread.id}_function)\n`;
      });
      
      code += `\n    # Запуск потоків\n`;
      threads.forEach(thread => {
        code += `    thread_${thread.id}.start()\n`;
      });
      
      code += `\n    # Очікування завершення всіх потоків\n`;
      threads.forEach(thread => {
        code += `    thread_${thread.id}.join()\n`;
      });
      
      code += `\nif __name__ == "__main__":\n`;
      code += `    main()\n`;
      
      return code;
    }
  };
  
  export default CodeGenerator;