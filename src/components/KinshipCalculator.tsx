import React, { useState } from 'react';
import { DetailedMember } from '../types/member';
import { calculateKinship } from '../utils/kinshipCalculator';

interface KinshipCalculatorProps {
  members: DetailedMember[];
}

export const KinshipCalculator: React.FC<KinshipCalculatorProps> = ({ members }) => {
  const [personAId, setPersonAId] = useState<string>('');
  const [personBId, setPersonBId] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);

  const handleCalculate = () => {
    if (!personAId || !personBId) return;
    const personA = members.find(m => m.id === personAId);
    const personB = members.find(m => m.id === personBId);

    if (personA && personB) {
      const kinship = calculateKinship(personA, personB, members);
      setResult(`Theo vai vế, ${personA.name} phải gọi ${personB.name} là: ` + kinship);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg border border-wood-light/20 p-6 md:p-8 mt-8">
      <h2 className="text-2xl font-serif text-burgundy mb-6 text-center border-b pb-4">
        Công cụ tính Xưng Hô (Vai Vế)
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-2">Người Xưng (Người A)</label>
          <select 
            value={personAId}
            onChange={(e) => setPersonAId(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-bronze focus:ring focus:ring-bronze/50 p-2 border"
          >
            <option value="">-- Chọn thành viên --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name} (Đời {m.generation})</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-wood-dark mb-2">Người Gọi (Người B)</label>
          <select 
            value={personBId}
            onChange={(e) => setPersonBId(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-bronze focus:ring focus:ring-bronze/50 p-2 border"
          >
            <option value="">-- Chọn thành viên --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name} (Đời {m.generation})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <button
          onClick={handleCalculate}
          disabled={!personAId || !personBId}
          className="bg-wood hover:bg-wood-dark text-white font-medium py-2 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tính toán Xưng Hô
        </button>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-orange-50 border-l-4 border-bronze rounded-r-md">
          <p className="text-lg text-wood-dark font-medium text-center">
            {result}
          </p>
        </div>
      )}
    </div>
  );
};
