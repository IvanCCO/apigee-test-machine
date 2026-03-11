function formatContent(content) {
  if (content == null || content == undefined || content == "") {
    throw new Error("Content is required");
  }

  if (typeof content === "object") {
    return content;
  }

  if (Array.isArray(content)) {
    return {
      content: content,
    };
  }

  return content;
}
