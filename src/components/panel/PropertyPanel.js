import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

const PropertyPanel = ({ selectedBlock, variables, onUpdateBlock, onRemoveBlock, onSelectBlock }) => {
  // Додаємо локальний стан для зберігання значення константи
  const [constantValue, setConstantValue] = useState('0');
  
  // Використовуємо useEffect для синхронізації значення
  useEffect(() => {
    if (selectedBlock && selectedBlock.type === 'assign' && !selectedBlock.properties?.isVariable) {
      const varName = selectedBlock.properties?.variable;
      if (varName) {
        const variable = variables.find(v => v.name === varName);
        if (variable) {
          // Оновлюємо локальне значення
          setConstantValue(variable.value.toString());
          
          // Також оновлюємо властивості блока, якщо значення змінилося
          if (selectedBlock.properties.value !== variable.value.toString()) {
            const updatedProperties = {
              ...selectedBlock.properties,
              value: variable.value.toString()
            };
            onUpdateBlock(selectedBlock.id, updatedProperties);
          }
        }
      }
    } else if (selectedBlock) {
      // Оновлюємо локальний стан значенням з блоку
      setConstantValue(selectedBlock.properties?.value || '0');
    }
  }, [selectedBlock, variables, onUpdateBlock]);

  if (!selectedBlock) {
    return (
      <div className="text-gray-500 text-center py-4">
        Виберіть блок, щоб побачити його властивості
      </div>
    );
  }
  
  // Обробка зміни властивості
  const handlePropertyChange = (property, value) => {
    const updatedProperties = { ...selectedBlock.properties };
    updatedProperties[property] = value;
    onUpdateBlock(selectedBlock.id, updatedProperties);
    
    // Якщо змінюється значення, оновлюємо також локальний стан
    if (property === 'value') {
      setConstantValue(value);
    }
  };
  
  // Оновлений обробник для зміни змінної
  const handleVariableChange = (e) => {
    const varName = e.target.value;
    
    // Знаходимо вибрану змінну
    const selectedVar = variables.find(v => v.name === varName);
    
    // Створюємо нові властивості з оновленою змінною
    const updatedProperties = { 
      ...selectedBlock.properties,
      variable: varName 
    };
    
    // Якщо це блок присвоєння і тип значення - константа, 
    // встановлюємо значення змінної як значення за замовчуванням
    if (selectedVar && selectedBlock.type === 'assign' && !selectedBlock.properties?.isVariable) {
      updatedProperties.value = selectedVar.value.toString();
      setConstantValue(selectedVar.value.toString());
    }
    
    // Оновлюємо блок з усіма змінами одночасно
    onUpdateBlock(selectedBlock.id, updatedProperties);
  };
  
  const handleSetConstantValue = () => {
    const currentValue = selectedBlock.properties?.value;
    
    const updatedProperties = {
      ...selectedBlock.properties,
      isVariable: false
    };
    
    if (typeof currentValue === 'string') {
      const selectedVar = variables.find(v => v.name === currentValue);
      if (selectedVar) {
        updatedProperties.value = selectedVar.value.toString();
        setConstantValue(selectedVar.value.toString());
      }
    }
    
    onUpdateBlock(selectedBlock.id, updatedProperties);
  };
  
  const handleSetVariableValue = () => {
    const updatedProperties = {
      ...selectedBlock.properties,
      isVariable: true
    };
    
    // Вибираємо першу доступну змінну як значення
    if (variables.length > 0) {
      updatedProperties.value = variables[0].name;
    }
    
    onUpdateBlock(selectedBlock.id, updatedProperties);
  };
  
  // Оновлений обробник зміни числового значення
  const handleNumericValueChange = (e) => {
    const value = e.target.value;
    // Дозволяємо порожній рядок (буде замінено на '0') або валідне число
    if (value === '' || (!isNaN(value) && parseInt(value) >= 0 && parseInt(value) <= 2147483647)) {
      const finalValue = value === '' ? '0' : value;
      handlePropertyChange('value', finalValue);
      setConstantValue(finalValue);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Властивості блоку</h3>
        <button
          className="text-red-500 hover:text-red-700"
          onClick={() => {
            onRemoveBlock();
          }}
          title="Видалити блок"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Тип блоку */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Тип блоку:</label>
          <div className="px-3 py-2 border rounded bg-gray-50">
            {selectedBlock.type === 'start' && 'Початок'}
            {selectedBlock.type === 'end' && 'Кінець'}
            {selectedBlock.type === 'assign' && 'Присвоєння'}
            {selectedBlock.type === 'input' && 'Ввід'}
            {selectedBlock.type === 'output' && 'Вивід'}
            {selectedBlock.type === 'condition' && 'Умова'}
          </div>
        </div>
        
        {/* Властивості для блоку присвоєння */}
        {selectedBlock.type === 'assign' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Змінна:</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedBlock.properties?.variable || ''}
                onChange={handleVariableChange}
              >
                <option value="">Виберіть змінну</option>
                {variables.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.value})</option>
                ))}
              </select>
            </div>
            
            {/* Оновлені кнопки вибору типу значення */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип значення:</label>
              <div className="grid grid-cols-2 gap-2">
                {/* Кнопка "Константа" */}
                <button
                  type="button"
                  className={`py-2 px-4 rounded border text-center ${
                    selectedBlock.properties?.isVariable === true
                      ? 'bg-white text-gray-700 border-gray-300' 
                      : 'bg-blue-500 text-white border-blue-500 font-medium'
                  }`}
                  onClick={handleSetConstantValue}
                >
                  Константа
                </button>
                
                {/* Кнопка "Змінна" */}
                <button
                  type="button"
                  className={`py-2 px-4 rounded border text-center ${
                    selectedBlock.properties?.isVariable === true
                      ? 'bg-blue-500 text-white border-blue-500 font-medium' 
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                  onClick={handleSetVariableValue}
                >
                  Змінна
                </button>
              </div>
            </div>
            
            {selectedBlock.properties?.isVariable ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Змінна для значення:</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={selectedBlock.properties?.value || ''}
                  onChange={(e) => handlePropertyChange('value', e.target.value)}
                >
                  <option value="">Виберіть змінну</option>
                  {variables.map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.value})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Значення:</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  min="0"
                  max="2147483647"
                  value={constantValue}
                  onChange={handleNumericValueChange}
                  onClick={(e) => e.target.select()}
                />
              </div>
            )}
          </>
        )}
        
        {/* Властивості для блоку вводу */}
        {selectedBlock.type === 'input' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Змінна для вводу:</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedBlock.properties?.variable || ''}
              onChange={handleVariableChange}
            >
              <option value="">Виберіть змінну</option>
              {variables.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.value})</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Властивості для блоку виводу */}
        {selectedBlock.type === 'output' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Змінна для виводу:</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedBlock.properties?.variable || ''}
              onChange={handleVariableChange}
            >
              <option value="">Виберіть змінну</option>
              {variables.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.value})</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Властивості для блоку умови */}
        {selectedBlock.type === 'condition' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Змінна для порівняння:</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedBlock.properties?.variable || ''}
                onChange={handleVariableChange}
              >
                <option value="">Виберіть змінну</option>
                {variables.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.value})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Оператор:</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedBlock.properties?.operator || '<'}
                onChange={(e) => handlePropertyChange('operator', e.target.value)}
              >
                <option value="<">Менше (&lt;)</option>
                <option value="<=">Менше або дорівнює (&le;)</option>
                <option value=">">Більше (&gt;)</option>
                <option value=">=">Більше або дорівнює (&ge;)</option>
                <option value="==">Дорівнює (==)</option>
                <option value="!=">Не дорівнює (!=)</option>
                <option value="%">Остача від ділення == 0</option>
                <option value="!%">Остача від ділення != 0</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Значення:</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                min="0"
                max="2147483647"
                value={selectedBlock.properties?.value || '0'}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(value) && parseInt(value) >= 0 && parseInt(value) <= 2147483647)) {
                    handlePropertyChange('value', value === '' ? '0' : value);
                  }
                }}
                onClick={(e) => e.target.select()}
              />
            </div>
          </>
        )}
        
        {/* Інформація про з'єднання */}
        <div className="mt-6 border-t pt-4">
          <h4 className="font-medium text-sm mb-2">Підказка по з'єднанням:</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Натисніть на круглі з'єднувачі, щоб створити зв'язок</p>
            <p>• Синій з'єднувач: наступний блок</p>
            {selectedBlock.type === 'condition' && (
              <>
                <p>• Зелений з'єднувач: шлях, якщо умова істинна</p>
                <p>• Червоний з'єднувач: шлях, якщо умова хибна</p>
              </>
            )}
          </div>
        </div>        
      </div>
    </div>
  );
};

export default PropertyPanel;