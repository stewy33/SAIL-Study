import React from "react"
import { Button } from "antd"
import { IssuesCloseOutlined, CheckCircleTwoTone } from "@ant-design/icons"

import clientApi from "./clientApi"

class ContestButton extends React.Component {
  constructor(props) {
    super(props)
    this.state = { clicked: false }
  }

  contest() {
    const { userResponseText, score, QID } = this.props
    this.setState({ clicked: true })
    clientApi.contestEvaluation(QID, userResponseText, score)
  }

  render() {
    const { clicked } = this.state

    if (!clicked) {
      return (
        <Button
          size="small"
          onClick={this.contest.bind(this)}
          style={{ marginBottom: "0.5em" }}
        >
          <IssuesCloseOutlined />I think that SAIL evaluated my response
          incorrectly
        </Button>
      )
    }

    return (
      <p>
        <CheckCircleTwoTone twoToneColor="#52c41a" /> Thank you for your
        feedback!
      </p>
    )
  }
}

export default ContestButton
