
import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center my-10">
      <div className="w-12 h-12 rounded-full animate-spin border-4 border-solid border-emerald-500 border-t-transparent"></div>
      <p className="mt-4 text-slate-600 font-medium">IA está analisando o documento...</p>
    </div>
  );
};
