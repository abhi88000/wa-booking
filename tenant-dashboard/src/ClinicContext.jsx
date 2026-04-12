import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const ClinicContext = createContext({ clinic: 'all', clinics: [], setClinic: () => {} });

export function ClinicProvider({ children }) {
  const [clinics, setClinics] = useState([]);
  const [clinic, setClinic] = useState('all');

  useEffect(() => {
    api.getSettings()
      .then(({ data }) => {
        const branches = data?.settings?.branches || [];
        setClinics(branches);
        // Auto-select if only 1 clinic
        if (branches.length === 1) {
          const label = branches[0].address ? `${branches[0].name} — ${branches[0].address}` : branches[0].name;
          setClinic(label);
        }
      })
      .catch(() => {});
  }, []);

  const clinicLabel = (c) => c.address ? `${c.name} — ${c.address}` : c.name;

  return (
    <ClinicContext.Provider value={{ clinic, clinics, setClinic, clinicLabel }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  return useContext(ClinicContext);
}
