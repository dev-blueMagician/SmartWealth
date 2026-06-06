/** Discovery layer API types (backend discovery package). */

export type DiscoveryQuestion = {
  questionId: string;
  module?: string | null;
  section?: string | null;
  questionText?: string | null;
  answerType?: string | null;
  repeatable?: boolean;
  requiredFlag?: boolean | null;
  conditionalFlag?: boolean | null;
  createdAt?: string | null;
};

export type DiscoveryQuestionOption = {
  id: string;
  questionId: string;
  optionValue?: string | null;
  optionLabel?: string | null;
};

export type DiscoveryAnswer = {
  id: string;
  caseId: string;
  questionId: string;
  blockIndex: number;
  answerValue: unknown;
  createdAt?: string | null;
};

export type DiscoveryFieldMapping = {
  id: string;
  questionId: string;
  systemField: string;
  entityType?: string | null;
  transformType?: string | null;
  createdAt?: string | null;
};

export type SubmitDiscoveryAnswerPayload = {
  caseId: string;
  questionId: string;
  blockIndex?: number;
  answerValue: unknown;
};

export type CreateDiscoveryMappingPayload = {
  questionId: string;
  systemField: string;
  entityType?: string | null;
  transformType?: string | null;
};

export type UpdateDiscoveryMappingPayload = CreateDiscoveryMappingPayload;

export type CreateDiscoveryQuestionPayload = {
  questionId: string;
  module?: string | null;
  section?: string | null;
  questionText?: string | null;
  answerType?: string | null;
  repeatable?: boolean;
  requiredFlag?: boolean | null;
  conditionalFlag?: boolean | null;
};

export type UpdateDiscoveryQuestionPayload = {
  module?: string | null;
  section?: string | null;
  questionText?: string | null;
  answerType?: string | null;
  repeatable?: boolean;
  requiredFlag?: boolean | null;
  conditionalFlag?: boolean | null;
};

export type CreateDiscoveryQuestionOptionPayload = {
  optionValue?: string | null;
  optionLabel?: string | null;
};

export type DiscoveryAiTextResponse = {
  text: string;
};

export type DiscoverySuggestMappingResponse = {
  systemField: string;
  entityType: string;
  transformType: string;
  rationale: string;
};

export type DiscoveryQuestionImportResult = {
  rowsRead: number;
  questionsCreated: number;
  questionsUpdated: number;
  questionsSkipped: number;
  optionsCreated: number;
  mappingsCreated: number;
  errors: string[];
};

export type FieldDictionaryEntry = {
  systemFieldName: string;
  rowNo?: number | null;
  dataDomain?: string | null;
  dataItem?: string | null;
  detailFieldGroup?: string | null;
  detailFieldNo?: number | null;
  detailFieldName?: string | null;
  fieldDescription?: string | null;
  dataType?: string | null;
  mandatoryLevel?: string | null;
  appliesTo?: string | null;
  suggestedSource?: string | null;
  validationRule?: string | null;
  usedFor?: string | null;
  sensitivity?: string | null;
  updateFrequency?: string | null;
  missingDataAction?: string | null;
  exampleValue?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

export type FieldDictionaryPageResult = {
  items: FieldDictionaryEntry[];
  total: number;
  page: number;
  size: number;
};

export type UpdateFieldDictionaryPayload = {
  rowNo?: number | null;
  dataDomain?: string | null;
  dataItem?: string | null;
  detailFieldGroup?: string | null;
  detailFieldNo?: number | null;
  detailFieldName?: string | null;
  fieldDescription?: string | null;
  dataType?: string | null;
  mandatoryLevel?: string | null;
  appliesTo?: string | null;
  suggestedSource?: string | null;
  validationRule?: string | null;
  usedFor?: string | null;
  sensitivity?: string | null;
  updateFrequency?: string | null;
  missingDataAction?: string | null;
  exampleValue?: string | null;
  notes?: string | null;
};

export type CreateFieldDictionaryPayload = UpdateFieldDictionaryPayload & {
  systemFieldName: string;
};

export type FieldDictionaryImportResult = {
  rowsRead: number;
  fieldsCreated: number;
  fieldsUpdated: number;
  fieldsSkipped: number;
  totalInDatabase: number;
  errors: string[];
};

export type DiscoveryRebuildResult = {
  caseId: string;
  fieldsWritten: number;
  filledCount: number;
  missingMaterializedCount: number;
  unmappedAnswerCount: number;
  mandatoryFieldsTotal: number;
  mandatoryFieldsFilled: number;
  mandatoryFieldsMissing: number;
  warnings: string[];
};

export type CaseDiscoveryFieldRow = {
  id: string;
  caseId: string;
  systemField: string;
  valueJsonb?: unknown;
  valueText?: string | null;
  source: string;
  status: string;
  questionId?: string | null;
  blockIndex?: number;
  mappingId?: string | null;
  dataDomain?: string | null;
  dataItem?: string | null;
  detailFieldName?: string | null;
  mandatoryLevel?: string | null;
  dataType?: string | null;
  updatedAt?: string | null;
};

export type CaseDiscoveryFieldPageResult = {
  items: CaseDiscoveryFieldRow[];
  total: number;
  page: number;
  size: number;
  mandatoryFieldsTotal: number;
  mandatoryFieldsFilled: number;
  mandatoryFieldsMissing: number;
};

export type DiscoverySummaryResult = {
  caseId: string;
  stats: {
    materializedFields: number;
    filledCount: number;
    missingMaterializedCount: number;
    mandatoryFieldsTotal: number;
    mandatoryFieldsFilled: number;
    mandatoryFieldsMissing: number;
    unmappedAnswerCount: number;
  };
  filledFields: {
    systemField: string;
    valueText?: string | null;
    dataDomain?: string | null;
    dataItem?: string | null;
    detailFieldName?: string | null;
    questionId?: string | null;
    blockIndex?: number | null;
  }[];
  missingMandatory: {
    systemField: string;
    dataDomain?: string | null;
    dataItem?: string | null;
    detailFieldName?: string | null;
    mandatoryLevel?: string | null;
  }[];
  unmappedAnswers: {
    questionId: string;
    blockIndex: number;
    answerValue: unknown;
    mappingSystemField?: string | null;
  }[];
  filledCountByDomain: Record<string, number>;
};
