import React from 'react';
import type { PositiveEntry } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DownloadIcon } from './icons';

interface MonthlyAnalysisTableProps {
  entries: PositiveEntry[];
  clientName: string;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const monthNames: { [key: string]: string } = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

export const MonthlyAnalysisTable: React.FC<MonthlyAnalysisTableProps> = ({ entries, clientName }) => {
  const analysis: {
    [description: string]: { [monthYear: string]: number; total: number };
  } = {};
  const monthlyTotals: { [monthYear: string]: number } = {};
  const allMonths = new Set<string>();

  entries.forEach(entry => {
    if (!entry.date || !entry.description) return;
    const [year, month] = entry.date.split('-');
    const monthYear = `${year}-${month}`;
    allMonths.add(monthYear);

    if (!analysis[entry.description]) {
      analysis[entry.description] = { total: 0 };
    }
    if (!analysis[entry.description][monthYear]) {
      analysis[entry.description][monthYear] = 0;
    }
    analysis[entry.description][monthYear] += entry.amount;
    analysis[entry.description].total += entry.amount;

    if (!monthlyTotals[monthYear]) {
      monthlyTotals[monthYear] = 0;
    }
    monthlyTotals[monthYear] += entry.amount;
  });

  const sortedMonths = Array.from(allMonths).sort();
  const sortedDescriptions = Object.keys(analysis).sort();
  

  const handleGeneratePdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const generationDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());

    // --- Calculations for Summary ---
    const grandTotal = Object.values(monthlyTotals).reduce((sum, total) => sum + total, 0);
    const transactionCount = entries.length;
    const numberOfMonths = sortedMonths.length;
    const monthlyAverage = numberOfMonths > 0 ? grandTotal / numberOfMonths : 0;
    
    const bestMonth = Object.entries(monthlyTotals).reduce((best, current) => {
        return current[1] > best[1] ? current : best;
    }, ['', 0]);

    const [bestMonthYear, bestMonthValue] = bestMonth;
    const [year, month] = bestMonthYear ? bestMonthYear.split('-') : ['', ''];
    const bestMonthFormatted = month ? `${monthNames[month]}/${year.slice(2)}` : 'N/A';
    
    const firstMonthStr = sortedMonths[0];
    const lastMonthStr = sortedMonths[sortedMonths.length - 1];
    const firstMonth = firstMonthStr ? `${monthNames[firstMonthStr.split('-')[1]]}/${firstMonthStr.split('-')[0].slice(2)}` : '';
    const lastMonth = lastMonthStr ? `${monthNames[lastMonthStr.split('-')[1]]}/${lastMonthStr.split('-')[0].slice(2)}` : '';
    const period = firstMonth && lastMonth ? (firstMonth === lastMonth ? firstMonth : `${firstMonth} a ${lastMonth}`) : 'N/A';

    // --- PDF Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Relatório de Análise de Créditos", 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Gerado pelo Analisador de Extratos com IA", 14, 26);
    
    doc.setFontSize(11);
    doc.setTextColor(48, 59, 72); // slate-700
    if (clientName.trim()) {
      doc.text(`Cliente: ${clientName.trim()}`, 14, 35);
    }
    doc.text(`Período Analisado: ${period}`, 14, 41);
    doc.text(`Gerado em: ${generationDate}`, pageWidth - 14, 35, { align: 'right' });
    
    doc.setLineWidth(0.2);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 48, pageWidth - 14, 48);

    // --- Summary Section ---
    const summaryStartY = 55;
    const boxWidth = (pageWidth - 28 - 30) / 4; // 28 for margins, 30 for gaps
    const boxHeight = 25;

    const drawSummaryBox = (x: number, title: string, value: string) => {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(x, summaryStartY, boxWidth, boxHeight, 3, 3, 'FD');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(title.toUpperCase(), x + 8, summaryStartY + 7);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(value, x + 8, summaryStartY + 18);
    };

    drawSummaryBox(14, "Total de Créditos", formatCurrency(grandTotal));
    drawSummaryBox(14 + boxWidth + 10, "Nº de Transações", transactionCount.toString());
    drawSummaryBox(14 + (boxWidth + 10) * 2, "Média Mensal", formatCurrency(monthlyAverage));
    drawSummaryBox(14 + (boxWidth + 10) * 3, "Mês de Maior Receita", `${bestMonthFormatted}`);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`(${formatCurrency(bestMonthValue)})`, 14 + (boxWidth + 10) * 3 + 8, summaryStartY + 23);


    // --- Monthly Analysis Table ---
    const monthlyTableHead = [
      'Análise Mensal por Descrição',
      ...sortedMonths.map(monthYear => {
        const [year, month] = monthYear.split('-');
        return `${monthNames[month]}/${year.slice(2)}`;
      }),
      'Total'
    ];
    const monthlyTableBody = sortedDescriptions.map(description => [
      description,
      ...sortedMonths.map(monthYear => analysis[description][monthYear] ? formatCurrency(analysis[description][monthYear]) : '-'),
      formatCurrency(analysis[description].total)
    ]);
    const monthlyTableFoot = [['Total Mensal', ...sortedMonths.map(monthYear => formatCurrency(monthlyTotals[monthYear])), formatCurrency(grandTotal)]];

    autoTable(doc, {
      startY: summaryStartY + boxHeight + 15,
      head: [monthlyTableHead],
      body: monthlyTableBody,
      foot: monthlyTableFoot,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // --- Detailed Transactions Table ---
    let detailedTableStartY = (doc as any).lastAutoTable.finalY + 15;
    if (detailedTableStartY > pageHeight - 40) {
        doc.addPage();
        detailedTableStartY = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Extrato Detalhado de Créditos", 14, detailedTableStartY);

    const detailedTableHead = ['Data', 'Descrição', 'Valor (R$)'];
    const sortedEntries = [...entries].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const formatDate = (dateString: string) => {
        if (!dateString || !dateString.includes('-')) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };
    const detailedTableBody = sortedEntries.map(entry => [
        formatDate(entry.date),
        entry.description,
        { content: formatCurrency(entry.amount), styles: { halign: 'right' } }
    ]);
    
    autoTable(doc, {
      startY: detailedTableStartY + 7,
      head: [detailedTableHead],
      body: detailedTableBody,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });

    // --- Add Page Footers ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 14, pageHeight - 8);
      doc.text('Relatório gerado pelo Analisador de Extratos com IA', pageWidth - 14, pageHeight - 8, { align: 'right' });
    }

    // --- Save File ---
    const safeFileName = clientName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_{2,}/g, '_');
    const fileName = safeFileName ? `relatorio_creditos_${safeFileName}.pdf` : 'relatorio_analise_creditos.pdf';
    doc.save(fileName);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-800">Resumo Mensal</h3>
          <button
            onClick={handleGeneratePdf}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            aria-label="Gerar PDF da análise mensal"
          >
            <DownloadIcon className="h-4 w-4" />
            <span>Gerar Relatório PDF</span>
          </button>
      </div>
      <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Descrição
                </th>
                {sortedMonths.map(monthYear => {
                    const [year, month] = monthYear.split('-');
                    return (
                        <th key={monthYear} scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                            {monthNames[month]}/{year.slice(2)}
                        </th>
                    );
                })}
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sortedDescriptions.map(description => (
                <tr key={description} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{description}</td>
                  {sortedMonths.map(monthYear => (
                    <td key={monthYear} className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-600">
                      {analysis[description][monthYear] ? formatCurrency(analysis[description][monthYear]) : '-'}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-800">
                    {formatCurrency(analysis[description].total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
              <tr>
                <td className="px-6 py-4 text-left text-sm font-bold uppercase text-slate-800">Total Mensal</td>
                {sortedMonths.map(monthYear => (
                  <td key={monthYear} className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-800">
                    {formatCurrency(monthlyTotals[monthYear])}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-emerald-700">
                  {formatCurrency(Object.values(monthlyTotals).reduce((sum, total) => sum + total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
      </div>
    </div>
  );
};