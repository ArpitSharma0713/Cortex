export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.flatten();

    return res.status(400).json({
      error: "Validation failed",
      details: {
        ...errors.fieldErrors,
        ...(errors.formErrors.length > 0 && { _form: errors.formErrors }),
      },
    });
  }

  req.body = result.data;
  return next();
};
