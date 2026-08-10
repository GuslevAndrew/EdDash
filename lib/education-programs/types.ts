export type EducationProgramRow = {
  id: number;
  region: string;
  institutionCode: string;
  institutionName: string;
  institutionTypeCode: string;
  institutionTypeName: string;
  fieldCode: string;
  specialityCode: string;
  specialityName: string;
  specializationCode: string | null;
  specializationName: string | null;
  programName: string;
};

export type EducationProgramsDataset = {
  source: string;
  year: number;
  totalRows: number;
  skippedOldCodes: number;
  skippedEmptyProgram: number;
  missingInstitutionLevel: number;
  rows: EducationProgramRow[];
};
