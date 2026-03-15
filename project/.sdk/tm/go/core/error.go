package core

type ProjectNameError struct {
	IsProjectNameError bool
	Sdk              string
	Code             string
	Msg              string
	Ctx              *Context
	Result           any
	Spec             any
}

func NewProjectNameError(code string, msg string, ctx *Context) *ProjectNameError {
	return &ProjectNameError{
		IsProjectNameError: true,
		Sdk:              "ProjectName",
		Code:             code,
		Msg:              msg,
		Ctx:              ctx,
	}
}

func (e *ProjectNameError) Error() string {
	return e.Msg
}
