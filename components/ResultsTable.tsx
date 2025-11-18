import React, { useState, useEffect } from 'react';
import type { PositiveEntry } from '../types';
import { TrashIcon, EditIcon } from './icons';

interface ResultsTableProps {
  entries: PositiveEntry[];
  setEntries: (entries: PositiveEntry[]) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ entries, setEntries }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedEntries, setEditedEntries] = useState<PositiveEntry[]>([]);

    useEffect(() => {
        setEditedEntries(JSON.parse(JSON.stringify(entries)));
    }, [entries]);

    const handleEditToggle = () => {
        if (isEditing) {
            setEditedEntries(JSON.parse(JSON.stringify(entries))); 
        }
        setIsEditing(!isEditing);
    };

    const handleSave = () => {
        setEntries(editedEntries);
        setIsEditing(false);
    };
    
    const handleEntryChange = (index: number, field: keyof PositiveEntry, value: string | number) => {
        const newEntries = [...editedEntries];
        if (field === 'amount') {
            const numValue = Number(value);
            newEntries[index] = { ...newEntries[index], [field]: isNaN(numValue) ? 0 : numValue };
        } else {
             newEntries[index] = { ...newEntries[index], [field]: value as string };
        }
        setEditedEntries(newEntries);
    };

    const handleAddRow = () => {
        const newEntry: PositiveEntry = { description: '', amount: 0, date: new Date().toISOString().split('T')[0] };
        setEditedEntries([...editedEntries, newEntry]);
    };

    const handleDeleteRow = (index: number) => {
        const newEntries = editedEntries.filter((_, i) => i !== index);
        setEditedEntries(newEntries);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        if (!dateString || !dateString.includes('-')) return 'N/A';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-slate-800">Extrato Detalhado de Créditos</h2>
                {!isEditing ? (
                    <button
                        onClick={handleEditToggle}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                        <EditIcon className="h-4 w-4" />
                        <span>Editar Transações</span>
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                         <button
                            onClick={handleSave}
                            className="inline-flex items-center gap-2 rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        >
                            Salvar Alterações
                        </button>
                        <button
                            onClick={handleEditToggle}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                        >
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
            <div className="overflow-x-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Descrição</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Data</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Valor (R$)</th>
                            {isEditing && <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {(isEditing ? editedEntries : entries).map((entry, index) => (
                            <tr key={index} className="hover:bg-slate-50">
                                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                    {isEditing ? (
                                        <input 
                                            type="text"
                                            value={entry.description}
                                            onChange={(e) => handleEntryChange(index, 'description', e.target.value)}
                                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                                        />
                                    ) : (
                                        entry.description
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    {isEditing ? (
                                        <input 
                                            type="date"
                                            value={entry.date || ''}
                                            onChange={(e) => handleEntryChange(index, 'date', e.target.value)}
                                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                                        />
                                    ) : (
                                        formatDate(entry.date)
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-emerald-600 font-semibold">
                                    {isEditing ? (
                                        <input 
                                            type="number"
                                            value={entry.amount}
                                            onChange={(e) => handleEntryChange(index, 'amount', e.target.value)}
                                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm text-right"
                                            step="0.01"
                                        />
                                    ) : (
                                        formatCurrency(entry.amount)
                                    )}
                                </td>
                                {isEditing && (
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <button
                                            onClick={() => handleDeleteRow(index)}
                                            className="text-red-600 hover:text-red-900"
                                            aria-label="Deletar transação"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isEditing && (
                <div className="mt-4">
                    <button
                        onClick={handleAddRow}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                        Adicionar Transação
                    </button>
                </div>
            )}
        </div>
    );
};
