import React from "react";
import { FormGroup, Label, Container, Col, FormText, Input, Spinner, Button } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { Form, Formik } from "formik";
import useTitle from "react-use/lib/useTitle";
import { MdEdit } from "react-icons/md";

import {
  ContentSection,
  IconButton,
  Loader,
  MultiSelectDropdownInput
} from "@certego/certego-ui";

import { useQuotaBadge } from "../../hooks";
import { usePluginConfigurationStore } from "../../stores";
import {
  TLP_CHOICES,
  TLP_DESCRIPTION_MAP,
  OBSERVABLE_TYPES,
  ALL_CLASSIFICATIONS
} from "../../constants";
import { TLPTag, markdownToHtml } from "../common";
import {
  RuntimeConfigurationModal,
  RecentScans,
  TagSelectInput
} from "./utils";
import { createJob } from "./api";

// constants
const groupAnalyzers = (analyzersList) => {
  const grouped = {
    ip: [],
    hash: [],
    domain: [],
    url: [],
    generic: [],
    file: [],
  };
  analyzersList.forEach((obj) => {
    // filter on basis of type
    if (obj.type === "file") {
      grouped.file.push(obj);
    } else {
      obj.observable_supported.forEach((clsfn) => grouped[clsfn].push(obj));
    }
  });
  return grouped;
};
const stateSelector = (state) => [
  state.loading,
  state.error,
  groupAnalyzers(state.analyzers),
  state.connectors,
];
const checkChoices = [
  {
    value: "check_all",
    label:
      "Do not execute if a similar analysis is currently running or reported without fails",
  },
  {
    value: "running_only",
    label: "Do not execute if a similar analysis is currently running",
  },
  {
    value: "force_new",
    label: "Force new analysis",
  },
];
const observableType2PropsMap = {
  ip: {
    placeholder: "8.8.8.8",
    pattern:
      "((^s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))s*$)|(^s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:)))(%.+)?s*$))",
  },
  url: {
    placeholder: "http://example.com/",
    pattern: "(www.|http://|https://).*",
  },
  domain: {
    placeholder: "scanme.org",
    pattern: "^(www)?[.]?[-_a-zA-Z0-9]+([.][a-zA-Z0-9]+)+$",
  },
  hash: {
    placeholder: "446c5fbb11b9ce058450555c1c27153c",
    pattern: "^[a-zA-Z0-9]{4,}$",
  },
  generic: {
    placeholder: "email, phone no., city, country, registry etc.",
    pattern: ".*",
  },
};
const initialValues = {
  classification: "ip",
  observable_name: undefined,
  file: undefined,
  analyzers: [],
  connectors: [],
  tlp: "WHITE",
  runtime_configuration: {},
  tags: [],
  check: "check_all",
};

// Component
export default function ScanForm() {
  console.debug("ScanForm rendered!");

  // local state
  const [classification, setClassification] = React.useState(
    initialValues.classification
  );
  const [isModalOpen, setModalOpen] = React.useState(false);
  const toggleModal = React.useCallback(
    () => setModalOpen((o) => !o),
    [setModalOpen]
  );

  // page title
  useTitle("IntelOwl | Scan", { restoreOnUnmount: true, });

  // router navigation
  const navigate = useNavigate();

  // use custom hooks
  const [{ MonthBadge, TotalBadge, QuotaInfoIcon, }, refetchQuota, quota] =
    useQuotaBadge();

  // API/ store
  const [pluginsLoading, pluginsError, analyzersGrouped, connectors] =
    usePluginConfigurationStore(stateSelector);

  const analyzersOptions = React.useMemo(
    () =>
      analyzersGrouped[classification]
        .map((v) => ({
          isDisabled: !v.verification.configured,
          value: v.name,
          label: (
            <div className="d-flex justify-content-start align-items-start flex-column">
              <div className="d-flex justify-content-start align-items-baseline flex-column">
                <div>{v.name}&nbsp;</div>
                <div className="small text-start text-muted">
                  {markdownToHtml(v.description)}
                </div>
              </div>
              {!v.verification.configured && (
                <div className="small text-danger">
                  ⚠ {v.verification.error_message}
                </div>
              )}
            </div>
          ),
          labelDisplay: v.name,
        }))
        .sort((a, b) =>
          // eslint-disable-next-line no-nested-ternary
          a.isDisabled === b.isDisabled ? 0 : a.isDisabled ? 1 : -1
        ),
    [analyzersGrouped, classification]
  );
  const connectorOptions = React.useMemo(
    () =>
      connectors
        .map((v) => ({
          isDisabled: !v.verification.configured,
          value: v.name,
          label: (
            <div className="d-flex justify-content-start align-items-start flex-column">
              <div className="d-flex justify-content-start align-items-baseline flex-column">
                <div>{v.name}&nbsp;</div>
                <div className="small text-start text-muted">
                  {markdownToHtml(v.description)}
                </div>
              </div>
              {!v.verification.configured && (
                <div className="small text-danger">
                  ⚠ {v.verification.error_message}
                </div>
              )}
            </div>
          ),
          labelDisplay: v.name,
        }))
        .sort((a, b) =>
          // eslint-disable-next-line no-nested-ternary
          a.isDisabled === b.isDisabled ? 0 : a.isDisabled ? 1 : -1
        ),
    [connectors]
  );

  // callbacks
  const onValidate = React.useCallback(
    (values) => {
      const errors = {};
      if (pluginsError) {
        errors.analyzers = pluginsError;
        errors.connectors = pluginsError;
      }
      if (values.classification === "file") {
        if (!values.file) {
          errors.file = "required";
        }
      } else if (values.observable_name) {
        const pattern = RegExp(
          observableType2PropsMap[values.classification].pattern
        );
        if (!pattern.test(values.observable_name)) {
          errors.observable_name = `invalid ${values.classification}`;
        }
      } else {
        errors.observable_name = "required";
      }
      if (!TLP_CHOICES.includes(values.tlp)) {
        errors.tlp = "Invalid choice";
      }
      return errors;
    },
    [pluginsError]
  );
  const onSubmit = React.useCallback(
    async (values, formik) => {
      const formValues = {
        ...values,
        tags_labels: values.tags.map((optTag) => optTag.value.label),
        analyzers: values.analyzers.map((x) => x.value),
        connectors: values.connectors.map((x) => x.value),
      };
      try {
        const jobId = await createJob(formValues);
        setTimeout(
          () => navigate(`/jobs/${jobId}`),
          1000
        );
      } catch (e) {
        // handled inside createJob
      } finally {
        refetchQuota();
        formik.setSubmitting(false);
      }
    },
    [navigate, refetchQuota]
  );

  return (
    <Container className="col-lg-12 col-xl-7">
      {/* Quota badges */}
      <ContentSection className="bg-body mb-2 d-flex-center">
        <MonthBadge className="me-2 text-larger" />
        <TotalBadge className="ms-2 me-3 text-larger" />
        <QuotaInfoIcon />
      </ContentSection>
      {/* Form */}
      <ContentSection id="ScanForm" className="mt-3 bg-body shadow">
        <h3 className="fw-bold">
          Scan&nbsp;
          {classification === "file" ? "File" : "Observable"}
        </h3>
        <hr />
        <Formik
          initialValues={initialValues}
          validate={onValidate}
          onSubmit={onSubmit}
          validateOnChange
        >
          {(formik) => (
            <Form>
                {ALL_CLASSIFICATIONS.map((ch) => (
                  <FormGroup check inline
                    key={`classification__${ch}`}
                  >
                    <Input
                      id={`classification__${ch}`}
                      type="radio"
                      name="classification"
                      value={ch}
                      onClick={() => {
                        setClassification(ch);
                        formik.setFieldValue("analyzers", []); // reset
                      }}
                    />
                    <Label check>
                      {ch}
                    </Label>
                  </FormGroup>
                ))}
              {OBSERVABLE_TYPES.includes(formik.values.classification) ? (
                <FormGroup row>
                  <Label
                    className="required"
                    sm={4}
                    for="observable_name"
                  >
                    Observable Value
                  </Label>
                  <Col sm={8}>
                    <Input
                      type="text"
                      id="observable_name"
                      name="observable_name"
                      className="input-dark"
                      {...observableType2PropsMap[formik.values.classification]}
                    />
                  </Col>
                </FormGroup>
              ) : (
                <FormGroup row>
                  <Label className="required" sm={4} for="file">
                    File
                  </Label>
                  <Col sm={8}>
                    <Input
                      type="file"
                      id="file"
                      name="file"
                      className="input-dark" />
                  </Col>
                </FormGroup>
              )}
              <FormGroup row>
                <Label sm={4} for="analyzers">
                  Select Analyzers
                </Label>
                <Col sm={8}>
                  <Loader
                    loading={pluginsLoading}
                    error={pluginsError}
                    render={() => (
                      <>
                        <MultiSelectDropdownInput
                          options={analyzersOptions}
                          value={formik.values.analyzers}
                          onChange={(v) => formik.setFieldValue("analyzers", v)}
                          // controlShouldRenderValue={false}
                        />
                        <FormText>
                          Default: all configured analyzers are triggered.
                        </FormText>
                      </>
                    )}
                  />
                </Col>
              </FormGroup>
              <FormGroup row>
                <Label sm={4} for="connectors">
                  Select Connectors
                </Label>
                <Col sm={8}>
                {!(pluginsLoading || pluginsError) && (
                  <>
                    <MultiSelectDropdownInput
                      options={connectorOptions}
                      value={formik.values.connectors}
                      onChange={(v) => formik.setFieldValue("connectors", v)}
                    />
                    <FormText>
                      Default: all configured connectors are triggered.
                    </FormText>
                  </>
                )}
                </Col>
              </FormGroup>
              <FormGroup row>
                <Label sm={4} for="scanform-runtimeconf-editbtn">
                  Runtime Configuration
                </Label>
                <Col sm={8}>
                  <IconButton
                    id="scanform-runtimeconf-editbtn"
                    Icon={MdEdit}
                    title="Edit runtime configuration"
                    titlePlacement="top"
                    size="sm"
                    color="tertiary"
                    disabled={
                      !(
                        formik.values.analyzers.length > 0 ||
                        formik.values.connectors.length > 0
                      )
                    }
                    onClick={toggleModal}
                  />
                  {isModalOpen && (
                    <RuntimeConfigurationModal
                      isOpen={isModalOpen}
                      toggle={toggleModal}
                      formik={formik}
                    />
                  )}
                </Col>
              </FormGroup>
              <FormGroup row>
                <Label sm={4}>
                  TLP
                </Label>
                <Col sm={8}>
                  {TLP_CHOICES.map((ch) => (
                    <FormGroup inline check
                      key={`tlpchoice__${ch}`}
                    >
                      <Label check
                        for={`tlpchoice__${ch}`}
                      >
                        <TLPTag value={ch} />
                      </Label>
                      <Input
                        id={`tlpchoice__${ch}`}
                        type="radio"
                        name="tlp"
                        value={ch}
                        onChange={formik.handleChange}
                      />
                    </FormGroup>
                  ))}
                  <FormText>
                    {TLP_DESCRIPTION_MAP[formik.values.tlp].replace(
                      "TLP: ",
                      ""
                    )}
                  </FormText>
                </Col>
              </FormGroup>
              <FormGroup row>
                <Label sm={4} id="scanform-tagselectinput">
                  Tags
                </Label>
                <Col sm={8}>
                  <TagSelectInput
                    id="scanform-tagselectinput"
                    selectedTags={formik.values.tags}
                    setSelectedTags={(v) =>
                      formik.setFieldValue("tags", v, false)
                    }
                  />
                </Col>
              </FormGroup>
              <FormGroup row className="mt-2">
                <Label sm={4}>
                  Extra configuration
                </Label>
                <Col sm={8}>
                  {checkChoices.map((ch) => (
                    <FormGroup check
                      key={`checkchoice__${ch.value}`}
                    >
                      <Input
                        id={`checkchoice__${ch.value}`}
                        type="radio"
                        name="check"
                        value={ch.value}
                        onChange={formik.handleChange}
                      />
                      <Label check
                        for={`checkchoice__${ch.value}`}
                      >
                        {ch.label}
                      </Label>
                    </FormGroup>
                  ))}
                </Col>
              </FormGroup>
              <Button
                type="submit"
                disabled={!(formik.isValid || formik.isSubmitting)}
                color="primary"
                size="lg"
                outline
                className="mx-auto rounded-0"
              >
                {formik.isSubmitting && <Spinner  size="sm" />}Start Scan
              </Button>
            </Form>
          )}
        </Formik>
      </ContentSection>
      {/* Recent Scans */}
      <h6 className="fw-bold">Recent Scans</h6>
      <RecentScans />
    </Container>
  );
}
